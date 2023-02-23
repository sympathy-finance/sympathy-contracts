// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./libraries/MerkleProof.sol";

import {IERC20} from "./interfaces/IERC20.sol";
import {IRewardTracker} from "./interfaces/IRewardTracker.sol";
import {IRouter} from "./interfaces/IRouter.sol";

contract BatchRouter is Initializable, UUPSUpgradeable {
    bool public executed;
    bool public isPublicSale;
    bool public isWhitelistSale;
    bool public lastExecutionStatus; //false - deposit , true - withdraw

    address public gov;

    address public want;
    address public sGlp;
    address public fsGlp;
    address public router;
    address public esSpy;
    
    uint256 constant PRECISION = 1e30;
    uint256 public executionFee;
    uint256 public depositLimit; // want decimals

    uint256 public currentDepositRound;
    uint256 public currentWithdrawRound;

    uint256 public cumulativeWantReward;
    uint256 public cumulativeEsSpyReward;

    uint256 public cumulativeWantRewardPerToken;
    uint256 public cumulativeEsSpyRewardPerToken;

    uint256 public totalSsGlpReceivedAmount;
    uint256 public totalWantReceivedAmount;

    uint256 public whitelistCapPerAccount;

    mapping (address => uint256) public wantBalances;
    mapping (address => uint256) public ssGlpBalances;
    mapping (uint256 => uint256) public totalWantPerRound;
    mapping (uint256 => uint256) public totalSsGlpPerRound;
    mapping (uint256 => uint256) public totalWantReceivedPerRound;
    mapping (uint256 => uint256) public totalSsGlpReceivedPerRound;

    mapping (uint256 => uint256) public cumulativeEsSpyRewardPerRound;
    mapping (uint256 => uint256) public cumulativeWantRewardPerRound;

    mapping (address => uint256) public depositRound;
    mapping (address => uint256) public withdrawRound;

    mapping(address => bool) public isHandler;

    address public feeSpyGlpTracker;
    address public stakedSpyGlpTracker;

    uint256 public pendingDealAmount;
    bytes32 public merkleRoot;

    event ReserveDeposit(address indexed account, uint256 amount, uint256 round);
    event ReserveWithdraw(address indexed account, uint256 amount, uint256 round);
    event CancelDeposit(address indexed account, uint256 amount, uint256 round);
    event CancelWithdraw(address indexed account, uint256 amount, uint256 round);
    event ClaimWant(address indexed account, uint256 round, uint256 balance, uint256 claimAmount);
    event ClaimStakedSpyGlp(
        address indexed account, 
        uint256 round, 
        uint256 balance, 
        uint256 claimAmount, 
        uint256 esSpyClaimable, 
        uint256 wantClaimable
    );
    event ExecuteBatchPositions(bool isWithdraw, uint256 amountIn);
    event ConfirmAndDealGlpDeposit(uint256 amountOut, uint256 round);
    event ConfirmAndDealGlpWithdraw(uint256 amountOut, uint256 round);
    event UpdateReward(
        uint256 esSpyAmount, 
        uint256 wantAmount, 
        uint256 cumulativeEsSpyRewardPerToken, 
        uint256 cumulativeWantRewardPerToken
    );
    event SetGov(address gov);
    event SetRouter(address router);
    event SetTrackers(address feeSpyGlpTracker, address stakedSpyGlpTracker);
    event SetExecutionFee(uint256 executionFee);
    event SetDepositLimit(uint256 limit);
    event SetHandler(address handler, bool isActive);
    event SetSale(bool isPublicSale, bool isWhitelistSale);
    event SetWhitelistCapPerAccount(uint256 amount);

    modifier onlyGov() {
        _onlyGov();
        _;
    }

    modifier onlyHandlerAndAbove() {
        _onlyHandlerAndAbove();
        _;
    }

    // function initialize(address _want, address _sGlp, address _esSpy) public initializer {
    //     want =_want;
    //     sGlp = _sGlp;
    //     esSpy = _esSpy;

    //     gov = msg.sender;
    //     executionFee = 0.0001 ether;
    //     currentDepositRound = 1;
    //     currentWithdrawRound = 1;
    // }

    constructor(address _want, address _sGlp, address _esSpy) {
        want =_want;
        sGlp = _sGlp;
        esSpy = _esSpy;

        gov = msg.sender;
        executionFee = 0.0001 ether;
        currentDepositRound = 1;
        currentWithdrawRound = 1;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyGov {}

    function _onlyGov() internal view {
        require(msg.sender == gov, "BatchRouter: not authorized");
    }

    function _onlyHandlerAndAbove() internal view {
        require(msg.sender == gov || isHandler[msg.sender], "BatchRouter: forbidden");
    }

    function setHandler(address _handler, bool _isActive) external onlyGov {
        require(_handler != address(0), "BatchRouter: invalid address");
        isHandler[_handler] = _isActive;
        emit SetHandler(_handler, _isActive);
    }

    function approveToken(address _token, address _spender) external onlyGov {
        IERC20(_token).approve(_spender, type(uint256).max);
    }

    function whitlelistReserveDeposit(bytes32[] calldata _merkleProf, uint256 _amount) public {
        require(!executed, "BatchRouter: batch under execution");
        require(isWhitelistSale, "BatchRouter: sale is closed");
        require(_verify(_merkleProf, msg.sender), "BatchRouter: invalid proof");
        if (wantBalances[msg.sender] > 0) {
            _claimStakedSpyGlp();
        }

        IERC20(want).transferFrom(msg.sender, address(this), _amount);
        totalWantPerRound[currentDepositRound] += _amount;
        require(totalWantPerRound[currentDepositRound] <= depositLimit, "BatchRouter: exceeded deposit limit");
        wantBalances[msg.sender] += _amount;
        require(whitelistCapPerAccount >= wantBalances[msg.sender], "BatchRouter: exceeded whitelist limit");

        if (depositRound[msg.sender] == 0) {
            depositRound[msg.sender] = currentDepositRound;
        }

        emit ReserveDeposit(msg.sender, _amount, depositRound[msg.sender]);

    }

    function reserveDeposit(uint256 _amount) external {
        require(!executed, "BatchRouter: batch under execution");
        require(isPublicSale, "BatchRouter: sale is closed");
        if (wantBalances[msg.sender] > 0) {
            _claimStakedSpyGlp();
        }

        IERC20(want).transferFrom(msg.sender, address(this), _amount);
        totalWantPerRound[currentDepositRound] += _amount;
        require(totalWantPerRound[currentDepositRound] <= depositLimit, "BatchRouter: exceeded deposit limit");
        wantBalances[msg.sender] += _amount;

        if (depositRound[msg.sender] == 0) {
            depositRound[msg.sender] = currentDepositRound;
        }

        emit ReserveDeposit(msg.sender, _amount, depositRound[msg.sender]);
    }

    function reserveWithdraw(uint256 _amount) external {
        require(!executed, "BatchRouter: batch under execution");
        if (ssGlpBalances[msg.sender] > 0) {
            _claimWant();
        }

        IRewardTracker(stakedSpyGlpTracker).unstakeForAccount(msg.sender, feeSpyGlpTracker, _amount, msg.sender);
        IRewardTracker(feeSpyGlpTracker).unstakeForAccount(msg.sender, sGlp, _amount, address(this));

        totalSsGlpPerRound[currentWithdrawRound] += _amount;
        ssGlpBalances[msg.sender] += _amount;
        
        if (withdrawRound[msg.sender] == 0) {
            withdrawRound[msg.sender] = currentWithdrawRound;
        }

        emit ReserveWithdraw(msg.sender, _amount, withdrawRound[msg.sender]);
    }

    function cancelDeposit(uint256 _amount) external {
        require(!executed, "BatchRouter: batch under execution");
        require(currentDepositRound == depositRound[msg.sender], "BatchRouter : batch already exectued");
        wantBalances[msg.sender] -= _amount;
        totalWantPerRound[currentDepositRound] -= _amount;

        IERC20(want).transfer(msg.sender, _amount);
        if (wantBalances[msg.sender] == 0) {
            depositRound[msg.sender] = 0;
        }

        emit CancelDeposit(msg.sender, _amount, currentDepositRound);
    }

    function cancelWithdraw(uint256 _amount) external {
        require(!executed, "BatchRouter: batch under execution");
        require(currentWithdrawRound == withdrawRound[msg.sender], "BatchRouter : batch already exectued");
        ssGlpBalances[msg.sender] -= _amount;
        totalSsGlpPerRound[currentWithdrawRound] -= _amount;
        
        IRewardTracker(feeSpyGlpTracker).stakeForAccount(address(this), msg.sender, sGlp, _amount);
        IRewardTracker(stakedSpyGlpTracker).stakeForAccount(msg.sender, msg.sender, feeSpyGlpTracker, _amount);
        
        if (ssGlpBalances[msg.sender] == 0) {
            withdrawRound[msg.sender] = 0;
        }

        emit CancelWithdraw(msg.sender, _amount, currentWithdrawRound);
    }

    function claimWant() external {
        _claimWant();
    }

    function claimStakedSpyGlp() external {
        _claimStakedSpyGlp();
    }

    function claim() external {
        _claimWant();
        _claimStakedSpyGlp();
    }

    function _claimWant() internal {
        uint256 round = withdrawRound[msg.sender];
        uint256 balance = ssGlpBalances[msg.sender];
        if (balance == 0) {
            return;
        }
        uint256 totalBalance = totalSsGlpPerRound[round];
        uint256 totalReceived = totalWantReceivedPerRound[round];

        uint256 claimAmount = totalReceived * balance / totalBalance;

        if (claimAmount == 0) {
            return;
        }

        IERC20(want).transfer(msg.sender, claimAmount);

        totalSsGlpPerRound[round] -= balance;
        totalWantReceivedPerRound[round] -= claimAmount;
        totalWantReceivedAmount -= claimAmount;

        ssGlpBalances[msg.sender] = 0;
        withdrawRound[msg.sender] = 0;

        emit ClaimWant(msg.sender, round, balance, claimAmount);
    }

    function _claimStakedSpyGlp() internal {
        uint256 round = depositRound[msg.sender];

        uint256 balance = wantBalances[msg.sender];
        if (balance == 0) {
            return;
        }

        uint256 claimAmount = totalSsGlpReceivedPerRound[round] * balance / totalWantPerRound[round];
        if (claimAmount == 0) {
            return;
        }

        _updateRewards();

        uint256 esSpyClaimable = claimAmount * (cumulativeEsSpyRewardPerToken - cumulativeEsSpyRewardPerRound[round]) / PRECISION;
        uint256 wantClaimable = claimAmount * (cumulativeWantRewardPerToken - cumulativeWantRewardPerRound[round]) / PRECISION;

        IERC20(esSpy).transfer(msg.sender, esSpyClaimable);
        IERC20(want).transfer(msg.sender, wantClaimable);

        IRewardTracker(stakedSpyGlpTracker).unstakeForAccount(address(this), feeSpyGlpTracker, claimAmount, address(this));
        IRewardTracker(feeSpyGlpTracker).unstakeForAccount(address(this), sGlp, claimAmount, address(this));

        IRewardTracker(feeSpyGlpTracker).stakeForAccount(address(this), msg.sender, sGlp, claimAmount);
        IRewardTracker(stakedSpyGlpTracker).stakeForAccount(msg.sender, msg.sender, feeSpyGlpTracker, claimAmount);

        totalSsGlpReceivedAmount -= claimAmount;
        totalSsGlpReceivedPerRound[round] -= claimAmount;
        totalWantPerRound[round] -= balance;

        wantBalances[msg.sender] = 0;
        depositRound[msg.sender] = 0;

        emit ClaimStakedSpyGlp(msg.sender, round, balance, claimAmount, esSpyClaimable, wantClaimable);
    }

    function executeBatchPositions(bool _isWithdraw, bytes[] calldata _params, uint256 _dealAmount) external payable onlyHandlerAndAbove {
        require(msg.value >= executionFee * 2, "BatchRouter: not enough execution Fee");
        uint256 amountIn = _isWithdraw ? totalSsGlpPerRound[currentWithdrawRound] : totalWantPerRound[currentDepositRound];
        IRouter(router).executePositionsBeforeDealGlp{value: msg.value}(amountIn, _params, _isWithdraw);

        pendingDealAmount = _dealAmount;
        lastExecutionStatus = _isWithdraw;

        executed = true; 

        emit ExecuteBatchPositions(_isWithdraw, amountIn);
    }

    // if Increase or Decrease position with GMX error need to withdraw and do ExecuteBatchPositions again.
    function reExecuteBatchPositions(bool _isWithdraw) external payable onlyHandlerAndAbove {
        IRouter(router).reExecuteBatchPositions(_isWithdraw);

        pendingDealAmount = 0;
        executed = false; 
    }

    function confirmAndDealGlp() external onlyHandlerAndAbove {
        require(executed, "BatchRouter: executes positions first");
        if (!lastExecutionStatus) {
            uint256 amountOut = IRouter(router).confirmAndBuy(pendingDealAmount, address(this));

            _updateRewards();

            totalSsGlpReceivedPerRound[currentDepositRound] = amountOut;

            cumulativeEsSpyRewardPerRound[currentDepositRound] = cumulativeEsSpyRewardPerToken;
            cumulativeWantRewardPerRound[currentDepositRound] = cumulativeWantRewardPerToken;

            totalSsGlpReceivedAmount += amountOut;
            currentDepositRound += 1;
            
            pendingDealAmount = 0;
            emit ConfirmAndDealGlpDeposit(amountOut, currentDepositRound - 1);
        } else {
            uint256 amountOut = IRouter(router).confirmAndSell(pendingDealAmount, address(this));
            totalWantReceivedPerRound[currentWithdrawRound] = amountOut;
            totalWantReceivedAmount += amountOut;
            currentWithdrawRound += 1;

            pendingDealAmount = 0;
            emit ConfirmAndDealGlpWithdraw(amountOut, currentWithdrawRound - 1);
        }
        executed = false;
    }

    function _updateRewards() internal {
        uint256 esSpyAmount = IRewardTracker(stakedSpyGlpTracker).claimForAccount(address(this), address(this));
        uint256 wantAmount = IRewardTracker(feeSpyGlpTracker).claimForAccount(address(this), address(this));

        uint256 totalSupply = totalSsGlpReceivedAmount;

        if (totalSupply > 0) {
            cumulativeEsSpyRewardPerToken += esSpyAmount * PRECISION / totalSupply;
            cumulativeWantRewardPerToken += wantAmount * PRECISION / totalSupply;
        }

        emit UpdateReward(esSpyAmount, wantAmount, cumulativeEsSpyRewardPerToken, cumulativeWantRewardPerToken);
    }

    function setRouter(address _router) external onlyGov {
        require(_router != address(0), "BatchRouter: invalid address");
        router = _router;
        emit SetRouter(_router);
    }

    function setDepositLimit(uint256 _limit) external onlyGov {
        depositLimit = _limit;
        emit SetDepositLimit(_limit);
    }

    function setTrackers(address _feeSpyGlpTracker, address _stakedSpyGlpTracker) external onlyGov {
        require(_feeSpyGlpTracker != address(0) && _stakedSpyGlpTracker != address(0), "BatchRouter: invalid address");
        feeSpyGlpTracker = _feeSpyGlpTracker;
        stakedSpyGlpTracker = _stakedSpyGlpTracker;
        emit SetTrackers(_feeSpyGlpTracker, _stakedSpyGlpTracker);
    }

    function setExecutionFee(uint256 _executionFee) external onlyGov {
        executionFee = _executionFee;
        emit SetExecutionFee(_executionFee);
    }

    function setWhitelistCapPerAccount(uint256 _amount) external onlyGov {
        whitelistCapPerAccount = _amount;
        emit SetWhitelistCapPerAccount(_amount);
    }

    function claimableWant(address _account) public view returns (uint256) {
        uint256 round = withdrawRound[_account];

        uint256 balance = ssGlpBalances[_account];
        if (balance == 0) {
            return 0;
        }
        uint256 totalBalance = totalSsGlpPerRound[round];
        uint256 totalReceived = totalWantReceivedPerRound[round];

        return totalReceived * balance / totalBalance;
    }

    function claimableSsGlp(address _account) public view returns (uint256) {
        uint256 round = depositRound[_account];

        uint256 balance = wantBalances[_account];
        if (balance == 0) {
            return 0;
        }
        uint256 totalBalance = totalWantPerRound[round];
        uint256 totalReceived = totalSsGlpReceivedPerRound[round];

        return totalReceived * balance / totalBalance;
    }

    function pendingRewards(address _account) public view returns (uint256, uint256) {
        uint256 ssGlpClaimable = claimableSsGlp(_account);

        if (ssGlpClaimable == 0) {
            return (0, 0);
        }
        
        uint256 wantAmount = IRewardTracker(feeSpyGlpTracker).claimable(address(this));
        uint256 esSpyAmount = IRewardTracker(stakedSpyGlpTracker).claimable(address(this));

        uint256 wantCumulativeReward = cumulativeWantReward + wantAmount;
        uint256 esSpyCumulativeReward = cumulativeEsSpyReward + esSpyAmount;

        uint256 wantClaimable = wantCumulativeReward * ssGlpClaimable / totalSsGlpReceivedAmount;
        uint256 esSpyClaimable = esSpyCumulativeReward * ssGlpClaimable / totalSsGlpReceivedAmount;

        return (wantClaimable, esSpyClaimable);
    }

    function setMerkleRoot(bytes32 _merkleRoot) external onlyGov {
        merkleRoot =  _merkleRoot;
    }

    function setSale(bool _isPublicSale, bool _isWhitelistSale) external onlyGov {
        isPublicSale = _isPublicSale;
        isWhitelistSale = _isWhitelistSale;
        emit SetSale(_isPublicSale, _isWhitelistSale);
    }

    function _verify(bytes32[] calldata _merkleProof, address _sender) private view returns (bool) {
        bytes32 leaf = keccak256(abi.encodePacked(_sender));
        return MerkleProof.verify(_merkleProof, merkleRoot, leaf);
    }
}