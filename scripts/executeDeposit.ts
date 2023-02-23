import * as dotenv from "dotenv";
import hre from "hardhat";
import addr from "../shared/constants/addresses";
import { expandDecimals, deployContract, bigNumberify, encode, getExpandedPrice2 } from "../shared/utils";
import { EXECUTION_FEE } from '../shared/constants/constant';

dotenv.config();

async function main() {
    const batchRouterC = await hre.ethers.getContractAt("BatchRouter", addr.BATCH_ROUTER);
    const currentDepositRound = await batchRouterC.currentDepositRound()
    const currentWithdrawRound = await batchRouterC.currentWithdrawRound()

    let totalWantPerRound = await batchRouterC.totalWantPerRound(currentDepositRound.toString())

    let sortAmount:any = totalWantPerRound * 0.1 // 10%
    let dealAmount = totalWantPerRound * 0.9 // 90%

    let btcSortAmount:any = sortAmount * 0.3
    let ethSortAmount:any = sortAmount - btcSortAmount

    sortAmount = Number(sortAmount.toFixed(1))
    btcSortAmount = Number(btcSortAmount.toFixed(1))
    ethSortAmount = Number(ethSortAmount.toFixed(1))

    if ((btcSortAmount / 1e18) < 15 || (ethSortAmount / 1e18) < 15) {
        console.log("NOT ENOUGH FOR SORT")
        return
    }

    console.log("sortAmount: ", sortAmount / 1e18)
    console.log("btcSortAmount: ", btcSortAmount / 1e18)
    console.log("ethSortAmount: ", ethSortAmount / 1e18)

    const paramsDeposit = [encode(
        ["address", "uint256", "uint256"],
        [addr.WBTC, btcSortAmount.toString(), getExpandedPrice2((btcSortAmount * 5.5) / 1e10).toString()]
    )]
    paramsDeposit.push(encode(
        ["address", "uint256", "uint256"],
        [addr.WETH, ethSortAmount.toString(), getExpandedPrice2((ethSortAmount * 5.5) / 1e10).toString()]
    ))

    await batchRouterC.executeBatchPositions(false, paramsDeposit, dealAmount.toString(), {value: EXECUTION_FEE * 2 });
    await batchRouterC.confirmAndDealGlp();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});