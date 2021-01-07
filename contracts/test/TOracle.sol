// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

import "../interface/IOracle.sol";

/**
 * @title Test Oracle implementation
 */
contract TOracle is IOracle {

    uint256 _price;

    function getPrice() public view override returns (uint256) {
        return _price;
    }

    function setPrice(uint256 price) public {
        _price = price;
    }

}
