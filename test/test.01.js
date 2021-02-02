const { expect } = require('chai');

describe('Deri Protocol - Test LToken', function () {

    let account1;
    let account2;
    let account3;
    let lToken;

    beforeEach(async function() {
        [account1, account2, account3] = await ethers.getSigners();

        lToken = await (await ethers.getContractFactory('LToken')).deploy('Deri liquidity token', 'DLT', account1.address);

        await lToken.mint(account2.address, 10000);
        await lToken.mint(account3.address, 10000);
        await lToken.connect(account2).approve(account1.address, 5000);
    });

    it('only pool can call mint', async function () {
        await expect(lToken.connect(account2).mint(account1.address, 10000)).to.be.reverted;
    });

    it('balance is correct', async function () {
        expect(await lToken.balanceOf(account2.address)).to.equal(10000);
    });

    it('totalSupply is correct', async function () {
        expect(await lToken.totalSupply()).to.equal(20000);
    });

    it('transfer is correct', async function () {
        await lToken.connect(account2).transfer(account1.address, 2000);
        expect(await lToken.balanceOf(account2.address)).to.equal(8000);
        expect(await lToken.balanceOf(account1.address)).to.equal(2000);
    });

    it('transferFrom is correct', async function () {
        await expect(lToken.transferFrom(account2.address, account3.address, 6000)).to.be.reverted;
        await lToken.transferFrom(account2.address, account3.address, 5000);
        expect(await lToken.balanceOf(account2.address)).to.equal(5000);
        expect(await lToken.balanceOf(account3.address)).to.equal(15000);
    });

    it('burn is correct', async function () {
        await lToken.burn(account2.address, 5000);
        expect(await lToken.balanceOf(account2.address)).to.equal(5000);
        expect(await lToken.totalSupply()).to.equal(15000);
    });

});
