// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { Governable } from "./libraries/Governable.sol";
import { IERC20 } from "./interfaces/IERC20.sol";

contract IDO is ReentrancyGuard, Governable {
    bool public isDeposit;
    bool public isClaimToken;

    uint256 public maxAmountDeposit;
    uint256 public hardCap;
    uint256 public rate;

    uint256 public totalDeposit;
    uint256 public totalClaim;
    address public tokenSell;

    mapping (address => uint256) public depositUsers;
    mapping (address => bool) public claimTokenUsers;

    event Deposit(address indexed account, uint256 amount);
    event ClaimTokenSell(address indexed account, uint256 amount);

    constructor(address _tokenSell) {
      tokenSell = _tokenSell;
      maxAmountDeposit = 5 * 10 ** 18;
      hardCap = 500 * 10 ** 18;
      rate = 100000;
    }

    function setIDOStatus(bool _isDeposit, bool _isClaimToken) external onlyGov {
      isDeposit = _isDeposit;
      isClaimToken = _isClaimToken;
    }
    
    function setTokens(address _tokenSell) external onlyGov {
      tokenSell = _tokenSell;
    }

    function setMaxAmountDeposit(uint256 _maxAmountDeposit) external onlyGov {
      maxAmountDeposit = _maxAmountDeposit;
    }

    function setHardCap(uint256 _hardCap) external onlyGov {
      hardCap = _hardCap;
    }

    function deposit() external payable nonReentrant {
      require(isDeposit, "IDO: deposit not active");

      uint256 amount = msg.value;
      uint256 totalAmount = amount + totalDeposit;
      
      require(totalAmount <= hardCap, "IDO: max hardcap");
      require((depositUsers[msg.sender] + amount) <= maxAmountDeposit, "IDO: max amount deposit per user");

      depositUsers[msg.sender] += amount;
      totalDeposit += amount;

      emit Deposit(msg.sender, amount);
    }

    function withDrawnFund(uint256 _amount) external onlyGov {
      _safeTransferETH(address(msg.sender), _amount);
    }

    function claimToken() external {
      require(isClaimToken, "IDO: claim token not active");
      require(depositUsers[msg.sender] > 0, "IDO: user don't have balance");
      require(!claimTokenUsers[msg.sender], "IDO: user already claim token");

      uint256 amountToken = depositUsers[msg.sender] * rate;

      IERC20(tokenSell).transfer(msg.sender, amountToken);
      claimTokenUsers[msg.sender] = true;
      totalClaim += amountToken;

      emit ClaimTokenSell(msg.sender, amountToken);
    }

    function _safeTransferETH(address to, uint256 value) internal {
        (bool success, ) = to.call{value: value}("");
        require(success, "TransferHelper: ETH_TRANSFER_FAILED");
    }

    /**
     * @notice Allows the owner to recover tokens sent to the contract by mistake
     * @param _token: token address
     * @dev Callable by owner
     */
    function recoverFungibleTokens(address _token) external onlyGov {
        uint256 amountToRecover = IERC20(_token).balanceOf(address(this));
        require(amountToRecover != 0, "Operations: No token to recover");

        IERC20(_token).transfer(address(msg.sender), amountToRecover);
    }
}