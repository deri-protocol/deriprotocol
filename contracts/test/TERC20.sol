// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

import "../interface/IERC20.sol";
import "../token/ERC20.sol";
import "../math/UnsignedSafeMath.sol";

/**
 * @title Test ERC20 token implementation with public mint function
 */
contract TERC20 is IERC20, ERC20 {

    using UnsignedSafeMath for uint256;

    constructor (string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    /**
     * @dev Public mint for Test ERC20 token
     * Emits a {Transfer} event
     */
    function mint(address account, uint256 amount) public {
        require(account != address(0), "TERC20: mint to zero address");

        _totalSupply = _totalSupply.add(amount);
        _balances[account] = _balances[account].add(amount);

        emit Transfer(address(0), account, amount);
    }

}
