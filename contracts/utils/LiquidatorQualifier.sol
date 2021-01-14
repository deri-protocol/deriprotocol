// SPDX-License-Identifier: MIT

pragma solidity >=0.6.2 <0.8.0;

import "../interface/IERC20.sol";
import "../interface/ILiquidatorQualifier.sol";
import "../math/UnsignedSafeMath.sol";
import "./SafeERC20.sol";

/**
 * @title Deri Protocol liquidator quanlifier implementation
 */
contract LiquidatorQualifier is ILiquidatorQualifier {

    using SafeERC20 for IERC20;
    using UnsignedSafeMath for uint256;

    address public controller;

    address public stakeTokenAddress;
    uint256 public totalStakedTokens;
    uint256 public totalStakers;
    mapping (address => uint256) public stakes;

    constructor (address stakeTokenAddress_) {
        controller = msg.sender;
        stakeTokenAddress = stakeTokenAddress_;
    }

    function setController(address newController) public {
        require(newController != address(0), "LiquidatorQualifier: setController to 0 address");
        require(msg.sender == controller, "LiquidatorQualifier: setController can only be called by controller");
        controller = newController;
    }

    function deposit(uint256 amount) public {
        require(amount != 0, "LiquidatorQualifier: deposit 0 stake tokens");
        IERC20(stakeTokenAddress).safeTransferFrom(msg.sender, address(this), amount);

        totalStakedTokens = totalStakedTokens.add(amount);
        if (stakes[msg.sender] == 0) {
            totalStakers = totalStakers.add(1);
        }
        stakes[msg.sender] = stakes[msg.sender].add(amount);
    }

    function withdraw(uint256 amount) public {
        require(amount != 0, "LiquidatorQualifier: withdraw 0 stake tokens");
        require(amount <= stakes[msg.sender], "LiquidatorQualifier: withdraw amount exceeds staked");

        totalStakedTokens = totalStakedTokens.sub(amount);
        if (stakes[msg.sender] == amount) {
            totalStakers = totalStakers.sub(1);
        }
        stakes[msg.sender] = stakes[msg.sender].sub(amount);

        IERC20(stakeTokenAddress).safeTransfer(msg.sender, amount);
    }

    function isQualifiedLiquidator(address liquidator) public view override returns (bool) {
        if (totalStakers == 0) {
            return false;
        }
        return stakes[liquidator] >= totalStakedTokens / totalStakers;
    }

}
