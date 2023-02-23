import * as dotenv from "dotenv";
import hre from "hardhat";
import addr from "../shared/constants/addresses";
import { expandDecimals } from "../shared/utils";
require("@nomiclabs/hardhat-etherscan");

dotenv.config();

const gmxHelperConfig = [
    addr.GMX.Vault,
    addr.GMX.glp,
    addr.GMX.fsGlp,
    addr.GMX.GlpManager,
    addr.GMX.PositionRouter,
    addr.GMX.usdg
]

const strategyVaultConfig = [
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

async function main() {
    // 0. SPY
    const SPY = await hre.ethers.getContractFactory("SPY");
    const spy = await SPY.deploy();
    await spy.deployed();
    console.log(`spy address : ${spy.address}`);

    // 1. sGLP
    const SpyGlp = await hre.ethers.getContractFactory("sGLP");
    const sGlp = await SpyGlp.deploy();
    await sGlp.deployed();
    console.log(`sGlp address : ${sGlp.address}`);

    // 2. esSPY
    const EsSPY = await hre.ethers.getContractFactory("EsSPY");
    const esSPY = await EsSPY.deploy();
    await esSPY.deployed();
    console.log(`esSPY address : ${esSPY.address}`);

    // 3. bnSPY
    const BnSPY = await hre.ethers.getContractFactory("BnSPY");
    const bnSPY = await BnSPY.deploy();
    await bnSPY.deployed();
    console.log(`bnSPY address : ${bnSPY.address}`);

    // 4. RewardRouter
    const RewardRouter = await hre.ethers.getContractFactory("RewardRouter");
    const rewardRouter = await RewardRouter.deploy();
    await rewardRouter.deployed();
    console.log(`rewardRouter address : ${rewardRouter.address}`);

    // 5. BonusSpyTracker
    const BonusSpyTracker = await hre.ethers.getContractFactory("BonusSpyTracker");
    const bonusSpyTracker = await BonusSpyTracker.deploy();
    await bonusSpyTracker.deployed();
    console.log(`bonusSpyTracker address : ${bonusSpyTracker.address}`);

    // 6. FeeSpyTracker
    const FeeSpyTracker = await hre.ethers.getContractFactory("FeeSpyTracker");
    const feeSpyTracker = await FeeSpyTracker.deploy();
    await feeSpyTracker.deployed();
    console.log(`feeSpyTracker address : ${feeSpyTracker.address}`);

    // 7. FeeSpyGlpTracker
    const FeeSpyGlpTracker = await hre.ethers.getContractFactory("FeeSpyGlpTracker");
    const feeSpyGlpTracker = await FeeSpyGlpTracker.deploy();
    await feeSpyGlpTracker.deployed();
    console.log(`feeSpyGlpTracker address : ${feeSpyGlpTracker.address}`);

    // 8. StakedSpyTracker
    const StakedSpyTracker = await hre.ethers.getContractFactory("StakedSpyTracker");
    const stakedSpyTracker = await StakedSpyTracker.deploy();
    await stakedSpyTracker.deployed();
    console.log(`stakedSpyTracker address : ${stakedSpyTracker.address}`);

    // 9. StakedSpyGlpTracker
    const StakedSpyGlpTracker = await hre.ethers.getContractFactory("StakedSpyGlpTracker");
    const stakedSpyGlpTracker = await StakedSpyGlpTracker.deploy();
    await stakedSpyGlpTracker.deployed();
    console.log(`stakedSpyGlpTracker address : ${stakedSpyGlpTracker.address}`)

    // 10. BonusDistributor
    const BonusDistributor = await hre.ethers.getContractFactory("BonusDistributor");
    const bonusDistributor = await BonusDistributor.deploy(
        bnSPY.address,
        bonusSpyTracker.address
    );
    await bonusDistributor.deployed();
    console.log(`bonusDistributor address : ${bonusDistributor.address}`);

    // 11. FeeSpyDistributor (DAI - SPY)
    const FeeSpyDistributor = await hre.ethers.getContractFactory("RewardDistributor");
    let rewardTokenAddr = process.env.HARDHAT_NETWORK === 'localhost' ? addr.WETH : addr.DAI
    const feeSpyDistributor = await FeeSpyDistributor.deploy(
        rewardTokenAddr,
        feeSpyTracker.address
    );
    await feeSpyDistributor.deployed();
    console.log(`feeSpyDistributor address : ${feeSpyDistributor.address}`);

    // 12. FeeSpyGlpDistributor (DAI - sGLP)
    const FeeSpyGlpDistributor = await hre.ethers.getContractFactory("RewardDistributor");
    const feeSpyGlpDistributor = await FeeSpyGlpDistributor.deploy(rewardTokenAddr, feeSpyGlpTracker.address);
    await feeSpyGlpDistributor.deployed();
    console.log(`feeSpyGlpDistributor address : ${feeSpyGlpDistributor.address}`);

    // 13. StakedSpyDistributor (esSPY - SPY)
    const StakedSpyDistributor = await hre.ethers.getContractFactory("RewardDistributor");
    const stakedSpyDistributor = await StakedSpyDistributor.deploy(
        esSPY.address,
        stakedSpyTracker.address
    );
    await stakedSpyDistributor.deployed();
    console.log(`stakedSpyDistributor address : ${stakedSpyDistributor.address}`);

    // 14. StakedSpyGlpDistributor (esSPY - sGLP)
    const StakedSpyGlpDistributor = await hre.ethers.getContractFactory("RewardDistributor");
    const stakedSpyGlpDistributor = await StakedSpyGlpDistributor.deploy(esSPY.address, stakedSpyGlpTracker.address);
    await stakedSpyGlpDistributor.deployed();
    console.log(`ssGlpDistributor address : ${stakedSpyGlpDistributor.address}`);

    // 15. Vester (SPY)
    const VesterSpy = await hre.ethers.getContractFactory("Vester");
    const vesterSpy = await VesterSpy.deploy(
        "Vested SPY",
        "vSPY",
        "31536000",
        esSPY.address,
        feeSpyTracker.address,
        spy.address,
        stakedSpyTracker.address
    );
    await vesterSpy.deployed();
    console.log(`vesterSpy address : ${vesterSpy.address}`);

    // 16. Vester (sGLP)
    const VesterSGlp = await hre.ethers.getContractFactory("Vester");
    const vesterSGlp = await VesterSGlp.deploy(
        "Vested sGLP",
        "vsGLP",
        "31536000",
        esSPY.address,
        stakedSpyGlpTracker.address,
        spy.address,
        stakedSpyGlpTracker.address
    );
    await vesterSGlp.deployed();
    console.log(`vesterSGlp address : ${vesterSGlp.address}`);

    // 17. Reader
    const Reader = await hre.ethers.getContractFactory("Reader");
    const reader = await Reader.deploy();
    await reader.deployed();
    console.log(`reader address : ${reader.address}`);

    // 18. StrategyVault
    // strategyVaultConfig.push(sGlp.address);
    // const StrategyVault = await hre.ethers.getContractFactory("StrategyVault");
    // const strategyVault = await hre.upgrades.deployProxy(StrategyVault, [strategyVaultConfig], { kind: "uups" });
    // console.log(`strategyVault address : ${strategyVault.address}`);

    strategyVaultConfig.push(sGlp.address);
    const StrategyVault = await hre.ethers.getContractFactory("StrategyVault");
    const strategyVault = await StrategyVault.deploy(strategyVaultConfig);
    await strategyVault.deployed();
    console.log(`strategyVault address : ${strategyVault.address}`);

    // 19. GmxHelper
    const GmxHelper = await hre.ethers.getContractFactory("GmxHelper");
    const gmxHelper = await GmxHelper.deploy(gmxHelperConfig, sGlp.address, addr.DAI, addr.WBTC, addr.WETH);
    await gmxHelper.deployed();
    console.log(`gmxHelper address : ${gmxHelper.address}`);

    // 21. BatchRouter
    // const BatchRouter = await hre.ethers.getContractFactory("BatchRouter");
    // const batchRouter = await hre.upgrades.deployProxy(BatchRouter, [addr.DAI, sGlp.address, esSPY.address], { kind: "uups" });
    // await batchRouter.deployed();
    // console.log(`batchRouter address : ${batchRouter.address}`);

    const BatchRouter = await hre.ethers.getContractFactory("BatchRouter");
    const batchRouter = await BatchRouter.deploy(addr.DAI, sGlp.address, esSPY.address);
    await batchRouter.deployed();
    console.log(`batchRouter address : ${batchRouter.address}`);

    // 20. Router
    const Router = await hre.ethers.getContractFactory("Router");
    const router = await Router.deploy(strategyVault.address, addr.DAI, addr.WBTC, addr.WETH, sGlp.address, batchRouter.address);
    await router.deployed();
    console.log(`router address : ${router.address}`);

    // 22. EsSPYManager
    const EsSPYManager = await hre.ethers.getContractFactory("EsSPYManager");
    const esSPYManager = await EsSPYManager.deploy(esSPY.address, vesterSpy.address);
    await esSPYManager.deployed();
    console.log(`esSPYManager address : ${esSPYManager.address}`);

    // 23. Whitlelist
    const Whitlelist = await hre.ethers.getContractFactory("Whitlelist");
    const whitlelist = await Whitlelist.deploy(addr.DAI, spy.address);
    await whitlelist.deployed();
    console.log(`Whitlelist address : ${whitlelist.address}`);

    // 24. IDO
    const IDO = await hre.ethers.getContractFactory("IDO");
    const ido = await IDO.deploy(spy.address);
    await ido.deployed();
    console.log(`Ido address : ${ido.address}`);

    // initialize tracker
    let tx = await feeSpyGlpTracker.initialize([sGlp.address], feeSpyGlpDistributor.address);
    await tx.wait();

    tx = await stakedSpyGlpTracker.initialize([feeSpyGlpTracker.address], stakedSpyGlpDistributor.address);
    await tx.wait();

    tx = await stakedSpyTracker.initialize([spy.address, esSPY.address], stakedSpyDistributor.address);
    await tx.wait();

    tx = await bonusSpyTracker.initialize([stakedSpyTracker.address], bonusDistributor.address);
    await tx.wait();

    tx = await feeSpyTracker.initialize([bonusSpyTracker.address, bnSPY.address], feeSpyDistributor.address);
    await tx.wait();

    // initialize rewardRouter
    tx = await rewardRouter.initialize(
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
    await tx.wait();

    /* ##################################################################
                            vester settings
    ################################################################## */
    tx = await vesterSpy.setHandlers([rewardRouter.address, esSPYManager.address], [true, true]);
    await tx.wait();

    tx = await vesterSGlp.setHandlers([rewardRouter.address], [true]);
    await tx.wait();

    /* ##################################################################
                            SPY settings
    ################################################################## */
    tx = await bnSPY.setHandlers([feeSpyTracker.address], [true]);
    await tx.wait();

    tx = await bnSPY.setMinter(rewardRouter.address, true);
    await tx.wait();

    tx = await sGlp.setHandlers([
        feeSpyGlpTracker.address,
        router.address,
        batchRouter.address
    ], [true, true, true]);
    await tx.wait();

    tx = await sGlp.setMinter(router.address, true);
    await tx.wait();

    tx = await sGlp.setMinter(strategyVault.address, true);
    await tx.wait();

    tx = await esSPY.setHandlers([
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
    await tx.wait();

    tx = await esSPY.setMinter(vesterSGlp.address, true);
    await tx.wait();

    tx = await esSPY.setMinter(vesterSpy.address, true);
    await tx.wait();

    tx = await esSPY.setMinter(esSPYManager.address, true);
    await tx.wait();
    /* ##################################################################
                            tracker settings
    ################################################################## */
    tx = await bonusDistributor.updateLastDistributionTime();
    await tx.wait();

    tx = await bonusDistributor.setBonusMultiplier(10000);
    await tx.wait();

    // stakedSpyTracker handler
    tx = await stakedSpyTracker.setHandlers([rewardRouter.address, bonusSpyTracker.address], [true, true]);
    await tx.wait();

    // bonusSpyTracker handler
    tx = await bonusSpyTracker.setHandlers([rewardRouter.address, feeSpyTracker.address], [true, true]);
    await tx.wait();

    // feeSpyGlpTracker handler
    tx = await feeSpyGlpTracker.setHandlers([
        stakedSpyGlpTracker.address,
        rewardRouter.address,
        router.address,
        batchRouter.address
    ], [true, true, true, true]);
    await tx.wait();

    // feeSpyTracker handler
    tx = await feeSpyTracker.setHandlers([vesterSpy.address, rewardRouter.address], [true, true]);
    await tx.wait();

    // stakedSpyGlpTracker handler
    tx = await stakedSpyGlpTracker.setHandlers([
        rewardRouter.address,
        vesterSGlp.address,
        router.address,
        batchRouter.address
    ], [true, true, true, true]);
    await tx.wait();

    /* ##################################################################
                            strategyVault settings
    ################################################################## */
    tx = await strategyVault.setGmxHelper(gmxHelper.address);
    await tx.wait();

    tx = await strategyVault.setRouter(router.address, true);
    await tx.wait();

    /* ##################################################################
                                router settings
    ################################################################## */

    tx = await router.setTrackers(feeSpyGlpTracker.address, stakedSpyGlpTracker.address);
    await tx.wait();

    tx = await router.setHandler(batchRouter.address, true);
    await tx.wait();

    tx = await router.setSale(true);
    await tx.wait();

    /* ##################################################################
                             batchRouter settings
     ################################################################## */

    tx = await batchRouter.setRouter(router.address);
    await tx.wait();

    tx = await batchRouter.approveToken(addr.DAI, router.address);
    await tx.wait();

    tx = await batchRouter.setDepositLimit(expandDecimals(2000000, 18));
    await tx.wait();

    tx = await batchRouter.setTrackers(feeSpyGlpTracker.address, stakedSpyGlpTracker.address);
    await tx.wait();

    // Setup Earn
    console.log("===DONE===")
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});