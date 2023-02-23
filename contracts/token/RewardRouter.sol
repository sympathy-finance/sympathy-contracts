// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import {IERC20} from "../interfaces/IERC20.sol";
import {IMintable} from "../interfaces/IMintable.sol";
import {IRewardTracker} from "../interfaces/IRewardTracker.sol";
import {IVester} from "../interfaces/IVester.sol";
import {IWETH} from "../interfaces/IWETH.sol";
import {Governable} from "../libraries/Governable.sol";

contract RewardRouter is ReentrancyGuard, Governable {
    bool public isInitialized;

    address public weth;

    address public spy;
    address public esSpy;
    address public bnSpy;

    address public spyGlp;

    address public stakedSpyTracker;
    address public bonusSpyTracker;
    address public feeSpyTracker;

    address public stakedSpyGlpTracker;
    address public feeSpyGlpTracker;

    address public spyVester;
    address public spyGlpVester;

    mapping(address => address) public pendingReceivers;

    event StakeSpy(address account, address token, uint256 amount);
    event UnstakeSpy(address account, address token, uint256 amount);

    event StakeSpyGlp(address account, uint256 amount);
    event UnstakeSpyGlp(address account, uint256 amount);

    receive() external payable {
        require(msg.sender == weth, "Router: invalid sender");
    }

    function initialize(
        address _weth,
        address _spy,
        address _esSpy,
        address _bnSpy,
        address _spyGlp,
        address _stakedSpyTracker,
        address _bonusSpyTracker,
        address _feeSpyTracker,
        address _feeSpyGlpTracker,
        address _stakedSpyGlpTracker,
        address _spyVester,
        address _spyGlpVester
    ) external onlyGov {
        require(!isInitialized, "RewardRouter: already initialized");
        isInitialized = true;

        weth = _weth;

        spy = _spy;
        esSpy = _esSpy;
        bnSpy = _bnSpy;

        spyGlp = _spyGlp;

        stakedSpyTracker = _stakedSpyTracker;
        bonusSpyTracker = _bonusSpyTracker;
        feeSpyTracker = _feeSpyTracker;

        feeSpyGlpTracker = _feeSpyGlpTracker;
        stakedSpyGlpTracker = _stakedSpyGlpTracker;

        spyVester = _spyVester;
        spyGlpVester = _spyGlpVester;
    }

    // to help users who accidentally send their tokens to this contract
    function withdrawToken(address _token, address _account, uint256 _amount) external onlyGov {
        IERC20(_token).transfer(_account, _amount);
    }

    function batchStakeSpyForAccount(
        address[] memory _accounts,
        uint256[] memory _amounts
    ) external nonReentrant onlyGov {
        address _spy = spy;

        for (uint256 i = 0; i < _accounts.length; i++) {
            _stakeSpy(msg.sender, _accounts[i], _spy, _amounts[i]);
        }
    }

    function stakeSpyForAccount(address _account, uint256 _amount) external nonReentrant onlyGov {
        _stakeSpy(msg.sender, _account, spy, _amount);
    }

    function stakeSpy(uint256 _amount) external nonReentrant {
        _stakeSpy(msg.sender, msg.sender, spy, _amount);
    }

    function stakeEsSpy(uint256 _amount) external nonReentrant {
        _stakeSpy(msg.sender, msg.sender, esSpy, _amount);
    }

    function unstakeSpy(uint256 _amount) external nonReentrant {
        _unstakeSpy(msg.sender, spy, _amount, true);
    }

    function unstakeEsSpy(uint256 _amount) external nonReentrant {
        _unstakeSpy(msg.sender, esSpy, _amount, true);
    }

    function claimSGlp() external nonReentrant {
        address account = msg.sender;

        IRewardTracker(feeSpyGlpTracker).claimForAccount(account, account);
        IRewardTracker(stakedSpyGlpTracker).claimForAccount(account, account);
    }

    function claim() external nonReentrant {
        address account = msg.sender;

        IRewardTracker(feeSpyTracker).claimForAccount(account, account);

        IRewardTracker(stakedSpyTracker).claimForAccount(account, account);
        IRewardTracker(stakedSpyGlpTracker).claimForAccount(account, account);
    }

    function claimEsSpy() external nonReentrant {
        address account = msg.sender;

        IRewardTracker(stakedSpyTracker).claimForAccount(account, account);
        IRewardTracker(stakedSpyGlpTracker).claimForAccount(account, account);
    }

    function claimFees() external nonReentrant {
        address account = msg.sender;

        IRewardTracker(feeSpyTracker).claimForAccount(account, account);
    }

    function compound() external nonReentrant {
        _compound(msg.sender);
    }

    function compoundForAccount(address _account) external nonReentrant onlyGov {
        _compound(_account);
    }

    function handleRewards(
        bool _shouldClaimSpy,
        bool _shouldStakeSpy,
        bool _shouldClaimEsSpy,
        bool _shouldStakeEsSpy,
        bool _shouldStakeMultiplierPoints,
        bool _shouldClaimFee
    ) external nonReentrant {
        address account = msg.sender;

        uint256 spyAmount = 0;
        if (_shouldClaimSpy) {
            uint256 spyAmount0 = IVester(spyVester).claimForAccount(account, account);
            uint256 spyAmount1 = IVester(spyGlpVester).claimForAccount(account, account);

            spyAmount = spyAmount0 + spyAmount1;
        }

        if (_shouldStakeSpy && spyAmount > 0) {
            _stakeSpy(account, account, spy, spyAmount);
        }

        uint256 esSpyAmount = 0;

        if (_shouldClaimEsSpy) {
            uint256 esSpyAmount0 = IRewardTracker(stakedSpyTracker).claimForAccount(account, account);
            uint256 esSpyAmount1 = IRewardTracker(stakedSpyGlpTracker).claimForAccount(account, account);
            esSpyAmount = esSpyAmount0 + esSpyAmount1;
        }

        if (_shouldStakeEsSpy && esSpyAmount > 0) {
            _stakeSpy(account, account, esSpy, esSpyAmount);
        }

        if (_shouldStakeMultiplierPoints) {
            uint256 bnSpyAmount = IRewardTracker(bonusSpyTracker).claimForAccount(account, account);

            if (bnSpyAmount > 0) {
                IRewardTracker(feeSpyTracker).stakeForAccount(account, account, bnSpy, bnSpyAmount);
            }
        }

        if (_shouldClaimFee) {
                IRewardTracker(feeSpyTracker).claimForAccount(account, account);
        }
    }

    function batchCompoundForAccounts(address[] memory _accounts) external nonReentrant onlyGov {
        for (uint256 i = 0; i < _accounts.length; i++) {
            _compound(_accounts[i]);
        }
    }

    function signalTransfer(address _receiver) external nonReentrant {
        require(IERC20(spyVester).balanceOf(msg.sender) == 0, "RewardRouter: sender has vested tokens");
        require(IERC20(spyGlpVester).balanceOf(msg.sender) == 0, "RewardRouter: sender has vested tokens");

        _validateReceiver(_receiver);
        pendingReceivers[msg.sender] = _receiver;
    }

    function acceptTransfer(address _sender) external nonReentrant {
        require(IERC20(spyVester).balanceOf(_sender) == 0, "RewardRouter: sender has vested tokens");
        require(IERC20(spyGlpVester).balanceOf(_sender) == 0, "RewardRouter: sender has vested tokens");

        address receiver = msg.sender;

        require(pendingReceivers[_sender] == receiver, "RewardRouter: transfer not signalled");
        delete pendingReceivers[_sender];

        _validateReceiver(receiver);
        _compound(_sender);

        uint256 stakedSpy = IRewardTracker(stakedSpyTracker).depositBalances(_sender, spy);
        if (stakedSpy > 0) {
            _unstakeSpy(_sender, spy, stakedSpy, false);
            _stakeSpy(_sender, receiver, spy, stakedSpy);
        }

        uint256 stakedEsSpy = IRewardTracker(stakedSpyTracker).depositBalances(_sender, esSpy);
        if (stakedEsSpy > 0) {
            _unstakeSpy(_sender, esSpy, stakedEsSpy, false);
            _stakeSpy(_sender, receiver, esSpy, stakedEsSpy);
        }

        uint256 stakedBnSpy = IRewardTracker(feeSpyTracker).depositBalances(_sender, bnSpy);
        if (stakedBnSpy > 0) {
            IRewardTracker(feeSpyTracker).unstakeForAccount(_sender, bnSpy, stakedBnSpy, _sender);
            IRewardTracker(feeSpyTracker).stakeForAccount(_sender, receiver, bnSpy, stakedBnSpy);
        }

        uint256 esSpyBalance = IERC20(esSpy).balanceOf(_sender);
        if (esSpyBalance > 0) {
            IERC20(esSpy).transferFrom(_sender, receiver, esSpyBalance);
        }

        uint256 spyGlpAmount = IRewardTracker(feeSpyGlpTracker).depositBalances(_sender, spyGlp);

        if (spyGlpAmount > 0) {
            IRewardTracker(stakedSpyGlpTracker).unstakeForAccount(_sender, feeSpyGlpTracker, spyGlpAmount, _sender);
            IRewardTracker(feeSpyGlpTracker).unstakeForAccount(_sender, spyGlp, spyGlpAmount, _sender);

            IRewardTracker(feeSpyGlpTracker).stakeForAccount(_sender, receiver, spyGlp, spyGlpAmount);
            IRewardTracker(stakedSpyGlpTracker).stakeForAccount(receiver, receiver, feeSpyGlpTracker, spyGlpAmount);
        }

        IVester(spyVester).transferStakeValues(_sender, receiver);
        IVester(spyGlpVester).transferStakeValues(_sender, receiver);
    }

    function _validateReceiver(address _receiver) private view {
        require(
            IRewardTracker(stakedSpyTracker).averageStakedAmounts(_receiver) == 0,
            "RewardRouter: stakedSpyTracker.averageStakedAmounts > 0"
        );
        require(
            IRewardTracker(stakedSpyTracker).cumulativeRewards(_receiver) == 0,
            "RewardRouter: stakedSpyTracker.cumulativeRewards > 0"
        );

        require(
            IRewardTracker(bonusSpyTracker).averageStakedAmounts(_receiver) == 0,
            "RewardRouter: bonusSpyTracker.averageStakedAmounts > 0"
        );
        require(
            IRewardTracker(bonusSpyTracker).cumulativeRewards(_receiver) == 0,
            "RewardRouter: bonusSpyTracker.cumulativeRewards > 0"
        );

        require(
            IRewardTracker(feeSpyTracker).averageStakedAmounts(_receiver) == 0,
            "RewardRouter: feeSpyTracker.averageStakedAmounts > 0"
        );
        require(
            IRewardTracker(feeSpyTracker).cumulativeRewards(_receiver) == 0,
            "RewardRouter: feeSpyTracker.cumulativeRewards > 0"
        );

        require(
            IVester(spyVester).transferredAverageStakedAmounts(_receiver) == 0,
            "RewardRouter: spyVester.transferredAverageStakedAmounts > 0"
        );
        require(
            IVester(spyVester).transferredCumulativeRewards(_receiver) == 0,
            "RewardRouter: spyVester.transferredCumulativeRewards > 0"
        );

        require(
            IRewardTracker(stakedSpyGlpTracker).averageStakedAmounts(_receiver) == 0,
            "RewardRouter: stakedSpyGlpTracker.averageStakedAmounts > 0"
        );
        require(
            IRewardTracker(stakedSpyGlpTracker).cumulativeRewards(_receiver) == 0,
            "RewardRouter: stakedSpyGlpTracker.cumulativeRewards > 0"
        );

        require(
            IRewardTracker(feeSpyGlpTracker).averageStakedAmounts(_receiver) == 0,
            "RewardRouter: feeSpyGlpTracker.averageStakedAmounts > 0"
        );
        require(
            IRewardTracker(feeSpyGlpTracker).cumulativeRewards(_receiver) == 0,
            "RewardRouter: feeSpyGlpTracker.cumulativeRewards > 0"
        );

        require(
            IVester(spyGlpVester).transferredAverageStakedAmounts(_receiver) == 0,
            "RewardRouter: spyGlpVester.transferredAverageStakedAmounts > 0"
        );
        require(
            IVester(spyGlpVester).transferredCumulativeRewards(_receiver) == 0,
            "RewardRouter: spyGlpVester.transferredCumulativeRewards > 0"
        );

        require(IERC20(spyVester).balanceOf(_receiver) == 0, "RewardRouter: spyVester.balance > 0");
        require(IERC20(spyGlpVester).balanceOf(_receiver) == 0, "RewardRouter: spyGlpVester.balance > 0");
    }

    function _compound(address _account) private {
        _compoundSpy(_account);
        _compoundSpyGlp(_account);
    }

    function _compoundSpy(address _account) private {
        uint256 esSpyAmount = IRewardTracker(stakedSpyTracker).claimForAccount(_account, _account);

        if (esSpyAmount > 0) {
            _stakeSpy(_account, _account, esSpy, esSpyAmount);
        }

        uint256 bnSpyAmount = IRewardTracker(bonusSpyTracker).claimForAccount(_account, _account);

        if (bnSpyAmount > 0) {
            IRewardTracker(feeSpyTracker).stakeForAccount(_account, _account, bnSpy, bnSpyAmount);
        }
    }

    function _compoundSpyGlp(address _account) private {
        uint256 esSpyAmount = IRewardTracker(stakedSpyGlpTracker).claimForAccount(_account, _account);

        if (esSpyAmount > 0) {
            _stakeSpy(_account, _account, esSpy, esSpyAmount);
        }
    }

    function _stakeSpy(address _fundingAccount, address _account, address _token, uint256 _amount) private {
        require(_amount > 0, "RewardRouter: invalid _amount");

        IRewardTracker(stakedSpyTracker).stakeForAccount(_fundingAccount, _account, _token, _amount);
        IRewardTracker(bonusSpyTracker).stakeForAccount(_account, _account, stakedSpyTracker, _amount);
        IRewardTracker(feeSpyTracker).stakeForAccount(_account, _account, bonusSpyTracker, _amount);

        emit StakeSpy(_account, _token, _amount);
    }

    function _unstakeSpy(address _account, address _token, uint256 _amount, bool _shouldReduceBnSpy) private {
        require(_amount > 0, "RewardRouter: invalid _amount");

        uint256 balance = IRewardTracker(stakedSpyTracker).stakedAmounts(_account);

        IRewardTracker(feeSpyTracker).unstakeForAccount(_account, bonusSpyTracker, _amount, _account);
        IRewardTracker(bonusSpyTracker).unstakeForAccount(_account, stakedSpyTracker, _amount, _account);
        IRewardTracker(stakedSpyTracker).unstakeForAccount(_account, _token, _amount, _account);

        if (_shouldReduceBnSpy) {
            uint256 bnSpyAmount = IRewardTracker(bonusSpyTracker).claimForAccount(_account, _account);

            if (bnSpyAmount > 0) {
                IRewardTracker(feeSpyTracker).stakeForAccount(_account, _account, bnSpy, bnSpyAmount);
            }

            uint256 stakedBnSpy = IRewardTracker(feeSpyTracker).depositBalances(_account, bnSpy);

            if (stakedBnSpy > 0) {
                uint256 reductionAmount = stakedBnSpy * _amount / balance;

                IRewardTracker(feeSpyTracker).unstakeForAccount(_account, bnSpy, reductionAmount, _account);
                IMintable(bnSpy).burn(_account, reductionAmount);
            }
        }

        emit UnstakeSpy(_account, _token, _amount);
    }
}
