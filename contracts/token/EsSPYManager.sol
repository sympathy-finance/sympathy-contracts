// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import {Governable} from "../libraries/Governable.sol";
import {IVester} from "../interfaces/IVester.sol";
import {IMintable} from "../interfaces/IMintable.sol";
import {IERC20} from "../interfaces/IERC20.sol";

contract EsSPYManager is Governable {
    address public esSpy;

    address public vester;

    mapping(address => uint256) private _balances;

    event Transfer(address sender, address recipient, uint256 amount);
    
    constructor(
        address _esSpy,
        address _vester
    ){
        esSpy = _esSpy;
        vester = _vester;
    }

    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function depositForAccount(address account, uint256 amount) public onlyGov {
        _balances[account] += amount;

        IMintable(esSpy).mint(address(this), amount);
    } 

    function burnForAccount(address account, uint256 amount) public onlyGov {
        _balances[account] -= amount;

        IMintable(esSpy).burn(address(this), amount);
    }

    function transfer(address _recipient, uint256 _amount) public returns (bool){
        require(_amount <= _balances[msg.sender], "EsSpyManager, not enough balance");
        require(_amount > 0, "EsSpyManager: invalid _amount");

        _transfer(msg.sender, _recipient, _amount);

        return true;
    }

    function _transfer(address _sender, address _recipient, uint256 _amount) private {
        _balances[_sender] -= _amount;

        uint256 userBonusRewards = IVester(vester).bonusRewards(_recipient);

        IVester(vester).setBonusRewards(_recipient, userBonusRewards + _amount);

        IERC20(esSpy).transfer(_recipient, _amount);

        emit Transfer(_sender, _recipient, _amount);
    }
}
