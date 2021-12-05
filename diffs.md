# Diffs
This file is meant to keep internal track of our verified source code diffed with trusted libraries. It is used by the Violin team internally to validate deployments.

## VaultChef
- [FTM: 0xf227906e9afb34879449cf5573429edcd196d42b](https://www.diffchecker.com/ebpWmBJW)
  - Disables ERC-1155 mint hooks (GOOD)
  - Ownable adjusted for pull pattern (GOOD)
  - [ERC-1155 supply tracking vulnerability](https://github.com/OpenZeppelin/openzeppelin-contracts/pull/2956) still present