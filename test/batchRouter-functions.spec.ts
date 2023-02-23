import hre from 'hardhat';
import addr from '../shared/constants/addresses';
import { expect, use } from 'chai';
import { solidity } from 'ethereum-waffle';
import { EXECUTION_FEE } from '../shared/constants/constant';
import { gmxProtocolFixture } from './fixtures/gmx-protocol';
import { sympathyProtocolFixture } from './fixtures/sympathy-protocols';
import { deployContract, expandDecimals, bigNumberify, encode } from '../shared/utils';

use(solidity)

describe('batchRouter-functions', () => {

    let sGlp;
    let esSPY;
    let feeSpyGlpTracker;
    let stakedSpyGlpTracker;
    let positionRouter;
    let fastPriceFeed;
    let keeper;
    let batchRouter;
    let dai;
    let deployer;
    let user0;
    let user1;
    let gmxVault;
    let strategyVault;
    let router;
    
    before(async() => {
        ({sGlp, esSPY, feeSpyGlpTracker, stakedSpyGlpTracker, batchRouter, strategyVault, router} = await sympathyProtocolFixture());
        ({dai, keeper, positionRouter, fastPriceFeed, gmxVault } = await gmxProtocolFixture());
        [deployer, user0, user1] = await hre.ethers.getSigners();

        await batchRouter.setSale(true, true);
    })

    it('reserves deposits - DAI', async () => {
        const whale = await hre.ethers.getImpersonatedSigner(addr.DAI_WHALE);
        await dai.connect(whale).transfer(user0.address, expandDecimals(100000, 18));
        await dai.connect(whale).transfer(user1.address, expandDecimals(100000, 18));
        await dai.connect(user0).approve(batchRouter.address, hre.ethers.constants.MaxUint256);
        await dai.connect(user1).approve(batchRouter.address, hre.ethers.constants.MaxUint256);

        await batchRouter.connect(user0).reserveDeposit(expandDecimals(90000, 18));
        await batchRouter.connect(user1).reserveDeposit(expandDecimals(90000, 18));

        expect(await batchRouter.wantBalances(user0.address)).eq(expandDecimals(90000, 18))
        expect(await batchRouter.depositRound(user0.address)).eq(bigNumberify(1));
        expect(await batchRouter.totalWantPerRound(1)).eq(expandDecimals(180000, 18));
    })

    it('cancels deposits - DAI', async () => {
        await batchRouter.connect(user0).cancelDeposit(expandDecimals(45000, 18));

        expect(await batchRouter.wantBalances(user0.address)).eq(expandDecimals(45000, 18));
        expect(await batchRouter.depositRound(user0.address)).eq(bigNumberify(1));
        expect(await batchRouter.totalWantPerRound(1)).eq(expandDecimals(135000, 18));

        await batchRouter.connect(user0).cancelDeposit(expandDecimals(45000, 18));

        expect(await batchRouter.wantBalances(user0.address)).eq(bigNumberify(0));
        expect(await batchRouter.depositRound(user0.address)).eq(bigNumberify(0));
        expect(await batchRouter.totalWantPerRound(1)).eq(expandDecimals(90000, 18));
    })

    it('executes batch positions and confirm - deposit', async () => {
        await batchRouter.connect(user0).reserveDeposit(expandDecimals(90000, 18));

        const params = [encode(
            ["address", "uint256", "uint256"],
            [addr.WBTC, expandDecimals(6300, 18).toString(), expandDecimals(6300 * 5.5, 30).toString()]
        )]
        params.push(encode(
            ["address", "uint256", "uint256"],
            [addr.WETH, expandDecimals(11700, 18).toString(), expandDecimals(11700 * 5.5, 30).toString()]
        ))

        await batchRouter.executeBatchPositions(false, params,expandDecimals(162000, 18),{value: EXECUTION_FEE * 2 });

        await expect(batchRouter.connect(user0).cancelDeposit(expandDecimals(45000, 18)))
            .to.be.revertedWith("BatchRouter: batch under execution");

        const increaseIndex = await positionRouter.increasePositionRequestKeysStart();
        const decreaseIndex = await positionRouter.decreasePositionRequestKeysStart();
        
        await fastPriceFeed.connect(keeper).setPricesWithBitsAndExecute(
            "0x14b6000016430012973300ff6478",
            1672655456,
            increaseIndex + 5,
            decreaseIndex + 5,
            2,
            10000
        )
        
        await batchRouter.confirmAndDealGlp();
        expect(await batchRouter.currentDepositRound()).eq(2);
    }
    )
    it('claims ssGlp', async () => { 
        await batchRouter.connect(user0).claimStakedSpyGlp();
        expect(await batchRouter.wantBalances(user0.address)).eq(0);
        expect(await batchRouter.depositRound(user0.address)).eq(0);

        await batchRouter.connect(user1).claimStakedSpyGlp();
        expect(await batchRouter.totalSsGlpReceivedPerRound(1)).eq(0);
        expect(await batchRouter.totalSsGlpReceivedAmount()).eq(0);

    })

    it('reserves withdraw - DAI', async () => {
        let user0Bal = await stakedSpyGlpTracker.balanceOf(user0.address);
        let user1Bal = await stakedSpyGlpTracker.balanceOf(user1.address);
        let totalSupply = await stakedSpyGlpTracker.totalSupply();

        await batchRouter.connect(user0).reserveWithdraw(user0Bal);
        expect(await batchRouter.ssGlpBalances(user0.address)).eq(user0Bal);
        expect(await batchRouter.withdrawRound(user0.address)).eq(1);

        await batchRouter.connect(user1).reserveWithdraw(user1Bal);
        expect(await batchRouter.totalSsGlpPerRound(1)).eq(totalSupply);
    })

    it('cancels withdraw - DAI', async () => {
        let user0Bal = await batchRouter.ssGlpBalances(user0.address);
        let user1Bal = await batchRouter.ssGlpBalances(user1.address);

        await batchRouter.connect(user0).cancelWithdraw(user0Bal);
        expect(await batchRouter.ssGlpBalances(user0.address)).eq(0);
        expect(await batchRouter.withdrawRound(user0.address)).eq(0);

        await batchRouter.connect(user1).cancelWithdraw(user1Bal);
        expect(await batchRouter.totalSsGlpPerRound(1)).eq(0);
    })

    it('execute batch positions and confirm - withdraw', async () => {
        await batchRouter.connect(user0).reserveWithdraw(expandDecimals(10000, 18));
        await batchRouter.connect(user1).reserveWithdraw(expandDecimals(10000, 18));

        const params = [encode(
            ["address", "uint256", "uint256", "address"],
            [addr.WBTC, expandDecimals(700, 30).toString(), expandDecimals(700 * 5.5, 30).toString(), router.address]
        )]
        params.push(encode(
            ["address", "uint256", "uint256", "address"],
            [addr.WETH, expandDecimals(2000, 30).toString(), expandDecimals(2000 * 5.5, 30).toString(), router.address]
        ))

        await batchRouter.executeBatchPositions(true, params,expandDecimals(24300, 18), { value : EXECUTION_FEE * 2});

        await expect(batchRouter.connect(user0).cancelWithdraw(expandDecimals(10000, 18)))
            .to.be.revertedWith("BatchRouter: batch under execution");

        const increaseIndex = await positionRouter.increasePositionRequestKeysStart();
        const decreaseIndex = await positionRouter.decreasePositionRequestKeysStart();
            
        await fastPriceFeed.connect(keeper).setPricesWithBitsAndExecute(
            "0x14b6000016430012973300ff6478",
            1672655456,
            increaseIndex + 5,
            decreaseIndex + 5,
            2,
            10000
        )
        
        await batchRouter.confirmAndDealGlp();
    })

    it('claims want', async () => {
        await batchRouter.connect(user0).claimWant();
        expect(await batchRouter.ssGlpBalances(user0.address)).eq(0);
        expect(await batchRouter.withdrawRound(user0.address)).eq(0);

        await batchRouter.connect(user1).claimWant();
        expect(await batchRouter.totalWantReceivedPerRound(1)).eq(0);
        expect(await batchRouter.totalWantReceivedAmount()).eq(0);

        expect(await batchRouter.currentWithdrawRound()).eq(2);
    })
})
