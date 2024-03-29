import { Call, Check, View, getBalanceView } from '../common.js';
import { contract } from '../helpers.js';

let temp;

/**
 * Supported vaults
 */
const vaults = [
	{
		id: '88952b043c344c38aa57c36fb392ccc4',
		title: 'Aave/Trava staking compatible',
		detect: [new View('REWARD_TOKEN()', [], 'address')],
		delegate: true,
		url: 'https://github.com/aave/aave-stake-v2',
		fetchs: {
			deposittoken: new View('STAKED_TOKEN()', [], 'address'),
		},
		deposit: new Call(
			null,
			'stake(address,uint256)',
			['__account__', '__amount__'],
			'0',
			{
				title: 'Deposit token to pool',
				params: ['Receiver', 'Amount'],
				editable: 1,
				gas: '110000',
			},
			new Check(
				getBalanceView('__account__', '__target__'),
				View.INCREASE,
				'__amount__'
			)
		),
		redeem: new Call(
			null,
			'redeem(address,uint256)',
			['__account__', '__amount__'],
			'0',
			{
				title: 'Redeem',
				params: ['Receiver', 'Amount'],
				editable: 1,
				gas: '114000',
			}
		),
	},
	{
		id: 'cd7907a180b14082850be75bac891857',
		title: 'Pancake CAKE compatible',
		detect: [new View('receiptToken()', [], 'address')],
		delegate: false,
		url: 'https://github.com/pancakeswap/pancake-swap-lib',
		fetchs: {
			deposittoken: new View('token()', [], 'address'),
			outputtoken: { get: (maps) => maps.target },
		},
		deposit: new Call(
			null,
			'deposit(uint256)',
			['__amount__'],
			'0',
			{
				title: 'Deposit token to pool',
				params: ['Amount'],
				editable: 0,
				gas: '100000',
			},
			new Check(
				new View(
					'userInfo(address)',
					['__account__'],
					'(uint256,uint256,uint256,uint256)',
					0
				),
				View.INCREASE,
				'0'
			)
		),
		redeem: new Call(null, 'withdrawAll()', [], '0', {
			title: 'Withdraw all',
			gas: '100000',
		}),
	},
	{
		id: '0c36be9a7355486fb1e1350a9ef6b670',
		title: 'MasterChef vaults compatible',
		detect: [new View('poolLength()', [], 'uint256')],
		delegate: false,
		url: 'https://github.com/pancakeswap/pancake-farm',
		url1: 'https://github.com/convex-eth/platform',
		fetchs: {
			deposittoken: [
				new View(
					'poolInfo(uint256)',
					['__poolid__'],
					'address,uint256,uint256,uint256',
					0
				),
				new View('lpToken(uint256)', ['__poolid__'], 'address'),
			],
		},
		deposit: new Call(
			null,
			'deposit(uint256,uint256)',
			['__poolid__', '__amount__'],
			'0',
			{
				title: 'Deposit token to pool',
				params: ['Amount', 'Receiver'],
				editable: 0,
				gas: '272000',
			},
			new Check(
				new View(
					'userInfo(uint256,address)',
					['__poolid__', '__account__'],
					'uint256,uint256,uint256',
					0
				),
				View.INCREASE,
				'__amount__'
			)
		),
		redeem: new Call(
			null,
			'withdraw(uint256,uint256)',
			['0', '__amount__'],
			'0',
			{
				title: 'Withdraw',
				params: ['Pool ID', 'Share amount'],
				editable: 1,
				gas: '100000',
			}
		),
	},
	{
		id: '2665ef392a5d4cf2bb7a0b72ff9b43e8',
		title: 'ALPACA Vault',
		detect: [new View('nextPositionID()')],
		fetchs: {
			deposittoken: new View('token()', [], 'address'),
			outputtoken: { get: (maps) => maps.target },
		},
		delegate: 'transfer',
		url: 'https://github.com/alpaca-finance/bsc-alpaca-contract',
		deposit: new Call(
			null,
			'deposit(uint256)',
			['__amount__'],
			'0',
			{
				title: 'Deposit to lend',
				params: ['Token amount'],
				editable: 1,
				gas: '140000',
			},
			new Check(getBalanceView(), View.DECREASE, '__amount__')
		),
		redeem: new Call(
			null,
			'withdraw(uint256)',
			['__balance__'],
			'0',
			{
				title: 'Withdraw token',
				params: ['Share amount'],
				editable: 0,
				gas: '135000',
			},
			new Check(new View(), View.INCREASE, '__balance__')
		),
	},
	{
		id: '9094127fefcc41c4992e90d9d37a9209',
		title: 'ALPACA Staking',
		detect: [new View('alpacaPerBlock()')],
		fetchs: {
			poolid: {
				get: async (maps) => {
					if (!maps.hasOwnProperty('poolid')) {
						const con = contract(maps.target, 'vaults.a', true);
						(
							await Promise.all(
								new Array(await con.poolLength())
									.fill()
									.map((e, i) => con.poolInfo(i))
							)
						).forEach(
							(e, i) =>
								e[0].toLowerCase() == maps.token &&
								(maps.poolid = i + 1)
						);
					}
					return maps.poolid;
				},
			},
			outputtoken: { get: (maps) => maps.target },
		},
		delegate: true,
		url: 'https://github.com/alpaca-finance/bsc-alpaca-contract/tree/main',
		deposit: new Call(
			null,
			'deposit(address,uint256,uint256)',
			['__account__', '__poolid__', '__amount__'],
			'0',
			{
				title: 'Staking deposit',
				params: ['Receiver', 'Pool ID', 'Token amount'],
				editable: 1,
				gas: '195000',
			},
			new Check(getBalanceView(), View.DECREASE, '__amount__')
		),
		redeem: new Call(
			null,
			'withdraw(uint256)',
			['__balance__'],
			'0',
			{
				title: 'Withdraw token',
				params: ['Share amount'],
				editable: 0,
				gas: '175000',
			},
			new Check(new View(), View.INCREASE, '__balance__')
		),
	},
	{
		id: '568623537d124769a4d00190fd7e35c5',
		title: 'Trava Goverance NFT vault',
		detect: [
			new View(
				'user_point_history__ts(uint256,uint256)',
				['1', '1'],
				'uint256'
			),
		],
		delegate: true,
		url: 'https://github.com/TravaLendingPool/GovernanceContract',
		fetchs: {
			//deposittoken: new View('tokens(uint256)', [0], 'address'),
			deposittoken: { get: (maps) => maps.token },
			outputtoken: { get: (maps) => maps.target },
			reward: new View('rewardToken()', [], 'address'),
		},
		deposit: new Call(
			null,
			'create_lock_for(address,uint256,uint256,address)',
			['__token__', '__amount__', '__locktime__', '__account__'],
			'0',
			{
				title: 'Lock token for voting power and rewards',
				params: ['Token', 'Amount', 'Lock duration', 'Receiver'],
				editable: 1,
				gas: '475000',
			},
			new Check(
				getBalanceView('__account__', '__target__'),
				View.INCREASE,
				'1'
			),
			{
				locktime: {
					default: '31536000',
					title: 'Lock duration in seconds',
					format: 'select',
					values: [
						[604800, 'One week'],
						[2592000, 'One month'],
						[15552000, '6 months'],
						[31536000, 'One year'],
						[126144000, '4 years'],
					],
					descs: 'In seconds: 604800 (a week), 2592000 (a month), 15552000 (6 months), 31536000 (a year), 126144000 (4 years)',
				},
			}
		),
		redeem: new Call(null, 'withdraw(uint256)', ['0'], '0', {
			title: 'Withdraw when lock has expired',
			params: ['Token ID'],
			gas: '100000',
		}),
	},
	/*
	{
		id: 'ad9141c23e664dffb7635e5894f34bc0',
		title: 'Curve Governance compatible',
		detect: [
			new View('user_point_epoch(uint256)', [1], 'uint256')
		],
		delegate: false,
		url: 'https://github.com/curvefi/curve-veBoost',
		fetchs: {
			deposittoken: new View('token()', [], 'address'),
			outputtoken: { get: maps => maps.target }
		},
		deposit: new Call(null, 'create_lock(uint256,uint256)', ['__amount__', '__time__'], '0', { title: 'Lock token for voting power and rewards', params: ['Amount', 'Lock duration'], editable: 0, gas: '100000' }, new Check(
			new View('locked(address)', ['__account__'], 'uint128,uint256', 0),
			View.INCREASE,
			'__amount__'
		), { time: { default: '31536000', title: 'Lock duration specifier', descs: 'In seconds: 604800 (a week), 2592000 (a month), 31536000 (a year), 126144000 (4 years)' } }),
		redeem: new Call(null, 'withdraw()', [], '0', { title: 'Withdraw when lock has expired', gas: '100000' })
	},
*/
	/*
	{
		id: '7ab2efe0a8974153a773eef60172c839',
		title: 'ALPACA Governance vault',
		detect: [
			new View(
				'userPointHistory(address,uint256)',
				['0x0000000000000000000000000000000000000000', '1'],
				'int128,int128,uint256,uint256',
				0
			),
		],
		delegate: false,
		url: 'https://github.com/alpaca-finance/xALPACA-contract',
		fetchs: {
			deposittoken: new View('token()', [], 'address'),
			outputtoken: { get: (maps) => maps.target },
		},
		deposit: new Call(
			null,
			'createLock(uint256,uint256)',
			['__amount__', '__time__'],
			'0',
			{
				title: 'Lock token for voting /power and rewards',
				params: ['Amount', 'Lock duration'],
				editable: 0,
				gas: '100000',
			},
			(temp = new Check(
				new View('locks(address)', ['__account__'], 'uint256'),
				View.INCREASE,
				'__amount__'
			)),
			{
				time: {
					default: '31536000',
					title: 'Lock duration specifier',
					descs: 'In seconds: 604800 (a week), 2592000 (a month), 31536000 (a year), 126144000 (4 years)',
				},
			}
		),
		depositx: new Call(
			null,
			'depositFor(address,uint256)',
			['__account__', '__amount__'],
			'0',
			{
				title: 'Increase lock balance without extend time',
				params: ['Account holder', 'Amount'],
				editable: 1,
				gas: '100000',
			},
			temp
		),
		redeem: new Call(null, 'withdraw()', [], '0', {
			title: 'Withdraw when lock has expired',
			gas: '100000',
		}),
	},
*/
	/*
	{
		id: '2665ef392a5d4cf2bb7a0b72ff9b43e8',
		title: 'ALPACA Delta vault',
		detect: [
			new View('valueToShare(uint256)', ['100000000'], 'uint256')
		],
		delegate: true,
		url: 'https://github.com/alpaca-finance/bsc-alpaca-contract/tree/main/solidity/contracts/8.10/protocol',
		fetchs: {
		},
		deposit: new Call(null, 'deposit(uint256,uint256,address,uint256,bytes)', [], '0', { title: 'Vault deposit', params: ['', '', '', '', '', ''], gas: '100000' }, new Check()),
		redeem: new Call(null, 'withdraw(uint256,uint256,uint256,bytes)', [], '0', { title: 'Withdraw token', params: ['', '', '', ''], gas: '100000' }, new Check())
	},
*/
	/*
	{
		id: '766a9d887b464cd0960b1fc4aab211d3',
		title: 'Olympus compatible',
		detect: [
			new View('OHM()', [], 'address')
		],
		delegate: true,
		url: 'https://github.com/OlympusDAO/olympus-contracts',
		fetchs: {
			deposittoken: new View('gOHM()', [], 'address')
		},
		deposit: new Call(null, 'stake(address,uint256,bool,bool)', ['__account__', '__amount__', 'true', 'true'], '0', { title: 'Deposit native to pool', params: ['Receiver', 'Amount', 'Rebasing', 'Claim'], editable: 1, gas: '100000' }, new Check(
			getBalanceView('__account__', '__deposittoken__'),
			View.INCREASE,
			'0'
		)),
		redeem: new Call(null, 'unstake(address,uint256,bool)', ['__account__', '__amount__', false], '0', { title: 'Unstake', params: ['Receiver', 'Amount', 'Trigger rebasing'], editable: 1, gas: '100000' })
	},
*/
];

export default vaults;
