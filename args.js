const spy = "0xe3838d801F4Fc67601167251fA1da107aAd389e4"
const sGlp = "0x7b7f55a29874796E3F0a90214b233b344e6fD335"
const esNEU = "0x093503209f2D0D4E6EA1A2941c89dD3ee6Dd8547"
const bnSpy = "0xf78B239D65525fD30331eF204a4B85c066F2A77C"
const bonusSpyTracker = "0xCd6d968e8Ca92356Be6394AC4455587F7FF2756C"
const rewardTokenAddr = "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1"
const feeSpyTracker = "0x4F1f55A666AfcD571d5A2a8B221EDc37A1Cfa16C"
const feeSpyGlpTracker = "0x005906f3bC2d756CdF9e49930BCa4bfB76a80246"
const stakedSpyTracker = "0x2325bec2Dc278cf52d2577bB3103d7EDeC13c569"
const stakedSpyGlpTracker = "0x8A505483d0a232B8B65ed9D3AACaEeF165634551"
const strategyVault = "0x81adE8c1a58034bC97d00e5483C7bEB18b529bab"
const vesterSpy = "0x19E3cDCff78977004D4067DBcdA6fa857ff25685"

const router = "0x9B8382F6eA9eEc697B633585Ef68c0Eb170577D0"
const batchRouter = "0x3433eB0376b371cF4f01F6912A87FCdc519C2ee2"

const addr = {
  WETH : "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
  WBTC : "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
  USDC : "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
  DAI : "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
  UNI: "0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0",
  LINK: "0xf97f4df75117a78c1A5a0DBb814Af92458539FB4",
  DAI_WHALE : "0xbDB910984f263fF8Cb96EE765067a8f95e0eD587",
  GMX : {
      Vault : "0x489ee077994B6658eAfA855C308275EAd8097C4A",
      GlpManager: "0x3963FfC9dff443c2A94f21b129D429891E32ec18",
      fsGlp: "0x1aDDD80E6039594eE970E5872D247bf0414C8903",
      glp: "0x4277f8F2c384827B5273592FF7CeBd9f2C1ac258",
      gmx: "0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a",
      sGmx: "0x908C4D94D34924765f1eDc22A1DD098397c59dD4",
      keeper: "0xbEe27BD52dB995D3c74Dc11FF32D93a1Aad747f7",
      usdg: "0x45096e7aA921f27590f8F19e457794EB09678141",
      PositionRouter: "0xb87a436B93fFE9D75c5cFA7bAcFff96430b09868",
      Router: "0xaBBc5F99639c9B6bCb58544ddf04EFA6802F4064",
      ReferralStorage: "0xe6fab3F0c7199b0d34d7FbE83394fc0e0D06e99d",
      RewardRouter: "0xA906F338CB21815cBc4Bc87ace9e68c87eF8d8F1",
      GlpRewardRouter: "0xB95DB5B167D75e6d04227CfFFA61069348d271F5",
      FastPriceFeed: "0x11D62807dAE812a0F1571243460Bf94325F43BB7",
  }
}

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
  sGlp
]

module.exports = [
  strategyVault, addr.DAI, addr.WBTC, addr.WETH, sGlp, batchRouter
];
