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

const spy = "0xe3838d801F4Fc67601167251fA1da107aAd389e4"
const sGlp = "0x7b7f55a29874796E3F0a90214b233b344e6fD335"
const esSPY = "0x093503209f2D0D4E6EA1A2941c89dD3ee6Dd8547"
const bnSPY = "0xf78B239D65525fD30331eF204a4B85c066F2A77C"
const bonusSpyTracker = "0xCd6d968e8Ca92356Be6394AC4455587F7FF2756C"
const rewardTokenAddr = "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1"
const feeSpyTracker = "0x4F1f55A666AfcD571d5A2a8B221EDc37A1Cfa16C"
const feeSpyGlpTracker = "0x005906f3bC2d756CdF9e49930BCa4bfB76a80246"
const stakedSpyTracker = "0x2325bec2Dc278cf52d2577bB3103d7EDeC13c569"
const stakedSpyGlpTracker = "0x8A505483d0a232B8B65ed9D3AACaEeF165634551"
// const strategyVault = "0x3029Ece73EE42B5a1D93a97A7526f140228Ede62"
const vesterSpy = "0x19E3cDCff78977004D4067DBcdA6fa857ff25685"
const esSPYManager = "0x018453933c3CaC3CD83b79C119Db699331B66871"
const rewardRouter = "0x8ad2Badb5fd9256BF6CBd6caB55d7b2d620b5c2A"
const stakedSpyDistributor = "0xcED9b06a49375ffA06705662F82A44E8892b9fD9"
const stakedSpyGlpDistributor = "0x196fE9F8B7776369F0b8Ae07c0C9186A3791a495"
const vesterSGlp = "0x84D22668a21ac1c67C0341938830972E23190a5d"
const gmxHelper = "0x057AF1A5AB5f873C1f9D357F7E86A5Db951e796D"

async function main() {
    let tx;
    strategyVaultConfig.push(sGlp);
    const StrategyVault = await hre.ethers.getContractFactory("StrategyVault");
    const strategyVault = await StrategyVault.deploy(strategyVaultConfig);
    await strategyVault.deployed();
    console.log(`strategyVault address : ${strategyVault.address}`);

    const BatchRouter = await hre.ethers.getContractFactory("BatchRouter");
    const batchRouter = await BatchRouter.deploy(addr.DAI, sGlp, esSPY);
    await batchRouter.deployed();
    console.log(`batchRouter address : ${batchRouter.address}`);

    // 20. Router
    const Router = await hre.ethers.getContractFactory("Router");
    const router = await Router.deploy(strategyVault.address, addr.DAI, addr.WBTC, addr.WETH, sGlp, batchRouter.address);
    await router.deployed();
    console.log(`router address : ${router.address}`);

    // 23. Whitlelist
    const Whitlelist = await hre.ethers.getContractFactory("Whitlelist");
    const whitlelist = await Whitlelist.deploy(addr.DAI, spy);
    await whitlelist.deployed();
    console.log(`Whitlelist address : ${whitlelist.address}`);

    // 24. IDO
    const IDO = await hre.ethers.getContractFactory("IDO");
    const ido = await IDO.deploy(spy);
    await ido.deployed();
    console.log(`Ido address : ${ido.address}`);

    const sGLPContract = await hre.ethers.getContractAt("sGLP", sGlp);
    tx = await sGLPContract.setHandlers([
        feeSpyGlpTracker,
        router.address,
        batchRouter.address
    ], [true, true, true]);
    await tx.wait();

    tx = await sGLPContract.setMinter(router.address, true);
    await tx.wait();

    tx = await sGLPContract.setMinter(strategyVault.address, true);
    await tx.wait();

    const esSPYContract = await hre.ethers.getContractAt("EsSPY", esSPY);
    tx = await esSPYContract.setHandlers([
        batchRouter.address,
        rewardRouter,
        stakedSpyDistributor,
        stakedSpyGlpDistributor,
        stakedSpyGlpTracker,
        stakedSpyTracker,
        vesterSGlp,
        vesterSpy,
        esSPYManager
    ], [true, true, true, true, true, true, true, true, true]);
    await tx.wait();

    tx = await esSPYContract.setMinter(vesterSGlp, true);
    await tx.wait();

    tx = await esSPYContract.setMinter(vesterSpy, true);
    await tx.wait();

    tx = await esSPYContract.setMinter(esSPYManager, true);
    await tx.wait();

    const feeSpyGlpTrackerC = await hre.ethers.getContractAt("FeeSpyGlpTracker", feeSpyGlpTracker);
    // feeSpyGlpTracker handler
    tx = await feeSpyGlpTrackerC.setHandlers([
        stakedSpyGlpTracker,
        rewardRouter,
        router.address,
        batchRouter.address
    ], [true, true, true, true]);
    await tx.wait();

    // feeSpyTracker handler
    tx = await feeSpyGlpTrackerC.setHandlers([vesterSpy, rewardRouter], [true, true]);
    await tx.wait();

    const stakedSpyGlpTrackerC = await hre.ethers.getContractAt("StakedSpyGlpTracker", stakedSpyGlpTracker);
    // stakedSpyGlpTracker handler
    tx = await stakedSpyGlpTrackerC.setHandlers([
        rewardRouter,
        vesterSGlp,
        router.address,
        batchRouter.address
    ], [true, true, true, true]);
    await tx.wait();

    /* ##################################################################
                            strategyVault settings
    ################################################################## */
    tx = await strategyVault.setGmxHelper(gmxHelper);
    await tx.wait();

    tx = await strategyVault.setRouter(router.address, true);
    await tx.wait();

    /* ##################################################################
                                router settings
    ################################################################## */

    tx = await router.setTrackers(feeSpyGlpTracker, stakedSpyGlpTracker);
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

    tx = await batchRouter.setTrackers(feeSpyGlpTracker, stakedSpyGlpTracker);
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