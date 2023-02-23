import { deployments } from "hardhat";
import addr from "../../shared/constants/addresses";
import { deployContract, expandDecimals } from "../../shared/utils";

export const gmxHelperConfig = [
    addr.GMX.Vault,
    addr.GMX.glp,
    addr.GMX.fsGlp,
    addr.GMX.GlpManager,
    addr.GMX.PositionRouter,
    addr.GMX.usdg
]

export const strategyVaultConfig = [
    addr.GMX.GlpManager,
    addr.GMX.PositionRouter,
    addr.GMX.RewardRouter,
    addr.GMX.GlpRewardRouter,
    addr.GMX.Router,
    addr.GMX.ReferralStorage,
    addr.GMX.fsGlp,
    addr.GMX.gmx,
    addr.GMX.sGmx,

    addr.DAI,
    addr.WBTC,
    addr.WETH,
]

export const sympathyProtocolFixture = deployments.createFixture(async hre => {
    // Deploy
    const spy = await deployContract("SPY", []);
    const sGlp = await deployContract("sGLP", []);
    const esSPY = await deployContract("EsSPY", []);
    const bnSPY = await deployContract("BnSPY", []);
    const rewardRouter = await deployContract("RewardRouter", []);
    const bonusSpyTracker = await deployContract("BonusSpyTracker", []);
    const feeSpyTracker = await deployContract("FeeSpyTracker", []);
    const feeSpyGlpTracker = await deployContract("FeeSpyGlpTracker", []);
    const stakedSpyTracker = await deployContract("StakedSpyTracker", []);
    const stakedSpyGlpTracker = await deployContract("StakedSpyGlpTracker", []);
    const bonusDistributor = await deployContract("BonusDistributor", [bnSPY.address, bonusSpyTracker.address]);
    const feeSpyDistributor = await deployContract("RewardDistributor", [addr.DAI, feeSpyTracker.address]);
    const feeSpyGlpDistributor = await deployContract("RewardDistributor", [addr.DAI, feeSpyGlpTracker.address]);
    const stakedSpyDistributor = await deployContract("RewardDistributor", [esSPY.address, stakedSpyTracker.address]);
    const stakedSpyGlpDistributor = await deployContract("RewardDistributor", [esSPY.address, stakedSpyGlpTracker.address]);
    const vesterSpy = await deployContract(
        "Vester",
        ["Vested SPY",
            "vSPY",
            "31536000",
            esSPY.address,
            feeSpyTracker.address,
            spy.address,
            stakedSpyTracker.address
        ]
    );

    const vesterSGlp = await deployContract(
        "Vester",
        ["Vested sGLP",
            "vsGLP",
            "31536000",
            esSPY.address,
            stakedSpyGlpTracker.address,
            spy.address,
            stakedSpyGlpTracker.address
        ]
    );
    const reader = await deployContract("Reader", []);
    strategyVaultConfig.push(sGlp.address);
    const StrategyVault = await hre.ethers.getContractFactory("StrategyVault");
    const strategyVault = await hre.upgrades.deployProxy(StrategyVault, [strategyVaultConfig], { kind: "uups" });
    const gmxHelper = await deployContract("GmxHelper", [gmxHelperConfig, sGlp.address, addr.DAI, addr.WBTC, addr.WETH]);
    const router = await deployContract("Router", [strategyVault.address, addr.DAI, addr.WBTC, addr.WETH, sGlp.address]);
    const BatchRouter = await hre.ethers.getContractFactory("BatchRouter");
    const batchRouter = await hre.upgrades.deployProxy(BatchRouter, [addr.DAI, sGlp.address, esSPY.address], {kind: "uups"});
    const esSPYManager = await deployContract("EsSpesSPYManager", [esSPY.address, vesterSpy.address]);


    // initialize tracker
    await feeSpyGlpTracker.initialize([sGlp.address], feeSpyGlpDistributor.address);
    await stakedSpyGlpTracker.initialize([feeSpyGlpTracker.address], stakedSpyGlpDistributor.address);
    await stakedSpyTracker.initialize([spy.address, esSPY.address], stakedSpyDistributor.address);
    await bonusSpyTracker.initialize([stakedSpyTracker.address], bonusDistributor.address);
    await feeSpyTracker.initialize([bonusSpyTracker.address, bnSPY.address], feeSpyDistributor.address);
    
    // initialize rewardRouter
    await rewardRouter.initialize(
        addr.WETH,
        spy.address,
        esSPY.address,
        bnSPY.address,
        sGlp.address,
        stakedSpyTracker.address,
        bonusSpyTracker.address,
        feeSpyTracker.address,
        feeSpyGlpTracker.address,
        stakedSpyGlpTracker.address,
        vesterSpy.address,
        vesterSGlp.address
    );

    /* ##################################################################
                            vester settings
    ################################################################## */
    await vesterSpy.setHandlers([rewardRouter.address, esSPYManager.address], [true, true]);
    await vesterSGlp.setHandlers([rewardRouter.address], [true]);

    /* ##################################################################
                            spy settings
    ################################################################## */
    await bnSPY.setHandlers([feeSpyTracker.address], [true]);
    await bnSPY.setMinter(rewardRouter.address, true);

    await sGlp.setHandlers([
        feeSpyGlpTracker.address,
        router.address, 
        batchRouter.address
    ], [true, true, true]);
    await sGlp.setMinter(router.address, true);
    await sGlp.setMinter(strategyVault.address, true);

    await esSPY.setHandlers([
        batchRouter.address,
        rewardRouter.address,
        stakedSpyDistributor.address,
        stakedSpyGlpDistributor.address,
        stakedSpyGlpTracker.address,
        stakedSpyTracker.address,
        vesterSGlp.address,
        vesterSpy.address,
        esSPYManager.address
    ], [true, true, true, true, true, true, true, true, true]);
    await esSPY.setMinter(vesterSGlp.address, true);
    await esSPY.setMinter(vesterSpy.address, true);
    await esSPY.setMinter(esSPYManager.address, true);

    /* ##################################################################
                            tracker settings
    ################################################################## */
    await bonusDistributor.updateLastDistributionTime();
    await bonusDistributor.setBonusMultiplier(10000);
    // stakedSpyTracker handler
    await stakedSpyTracker.setHandlers([rewardRouter.address, bonusSpyTracker.address], [true, true]);
    // bonusSpyTracker handler
    await bonusSpyTracker.setHandlers([rewardRouter.address, feeSpyTracker.address], [true, true]);
    // feeSpyGlpTracker handler
    await feeSpyGlpTracker.setHandlers([
        stakedSpyGlpTracker.address,
        rewardRouter.address,
        router.address,
        batchRouter.address
    ], [true, true, true, true]);
    // feeSpyTracker handler
    await feeSpyTracker.setHandlers([vesterSpy.address, rewardRouter.address], [true, true]);
    // stakedSpyGlpTracker handler
    await stakedSpyGlpTracker.setHandlers([
        rewardRouter.address,
        vesterSGlp.address,
        router.address,
        batchRouter.address
    ], [true, true, true, true]);
    
    /* ##################################################################
                            strategyVault settings
    ################################################################## */
    await strategyVault.setGmxHelper(gmxHelper.address);
    await strategyVault.setRouter(router.address, true);

    /* ##################################################################
                                router settings
    ################################################################## */
    await router.setTrackers(feeSpyGlpTracker.address, stakedSpyGlpTracker.address);
    await router.setHandler(batchRouter.address, true);
    await router.setSale(true);

    /* ##################################################################
                             batchRouter settings
     ################################################################## */
    await batchRouter.setRouter(router.address);
    await batchRouter.approveToken(addr.DAI, router.address);
    await batchRouter.setDepositLimit(expandDecimals(2000000, 18));
    await batchRouter.setTrackers(feeSpyGlpTracker.address, stakedSpyGlpTracker.address);

    return {
        spy,
        sGlp,
        esSPY,
        bnSPY,
        rewardRouter,
        bonusSpyTracker,
        feeSpyTracker,
        feeSpyGlpTracker,
        stakedSpyTracker,
        stakedSpyGlpTracker,
        bonusDistributor,
        feeSpyDistributor,
        feeSpyGlpDistributor,
        stakedSpyDistributor,
        stakedSpyGlpDistributor,
        vesterSpy,
        vesterSGlp,
        reader,
        strategyVault,
        gmxHelper,
        router,
        batchRouter,
        esSPYManager
    }
})