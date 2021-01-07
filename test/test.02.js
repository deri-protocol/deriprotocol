const { expect } = require('chai');

describe('Deri Protocol - Test PToken', function () {

    let account1;
    let account2;
    let account3;
    let pToken;

    beforeEach(async function() {
        [account1, account2, account3] = await ethers.getSigners();

        pToken = await (await ethers.getContractFactory('PToken')).deploy('Deri position token', 'DPT');

        await pToken.setPool(account1.address);

        await pToken.mint(account2.address, 10000);
        await pToken.mint(account3.address, 10000);
        await pToken.update(account2.address, -100, -2000, 1000, 20000, 1234567890);
        await pToken.connect(account2).approve(account1.address, 1);
    });

    it('only pool can call mint', async function () {
        await expect(pToken.connect(account2).mint(account1.address, 10000)).to.be.reverted;
    });

    it('balance is correct', async function () {
        expect(await pToken.balanceOf(account2.address)).to.equal(1);
    });

    it('totalSupply is correct', async function () {
        expect(await pToken.totalSupply()).to.equal(2);
    });

    it('safeTransferFrom by owner is correct', async function () {
        await pToken.connect(account2).functions['safeTransferFrom(address,address,uint256)'](account2.address, account1.address, 1);
        expect((await pToken.functions['exists(address)'](account2.address))[0]).to.be.false;
        expect((await pToken.functions['exists(address)'](account1.address))[0]).to.be.true;
    });

    it('safeTransferFrom by operator is correct', async function () {
        await pToken.functions['safeTransferFrom(address,address,uint256)'](account2.address, account1.address, 1);
        expect((await pToken.functions['exists(address)'](account2.address))[0]).to.be.false;
        expect((await pToken.functions['exists(address)'](account1.address))[0]).to.be.true;
    });

    it('can burn empty token', async function () {
        await pToken.burn(account3.address);
        expect((await pToken.functions['exists(address)'](account3.address))[0]).to.be.false;
        expect(await pToken.totalSupply()).to.equal(1);
        expect(await pToken.totalMinted()).to.equal(2);
    });

    it('cannot burn non empty token', async function () {
        await expect(pToken.burn(account2.address)).to.be.reverted;
    });

});
