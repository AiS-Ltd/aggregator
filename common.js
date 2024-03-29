import * as ethers from 'ethers';
import state from './state.js';
import {
	contract,
	debug,
	getAddress,
	getChain,
	getProvider,
	getSigner,
	getToken,
	invalidAddresses,
	isBN,
	sameToken,
	str,
	toBN,
	toPow,
} from './helpers.js';

const A0 = ethers.constants.AddressZero;
const IA = ethers.utils.isAddress;

ethers.BigNumber.prototype.toJSON = function () {
	return this.toString();
};
ethers.logger.warn = function () {};

/**
 * @typedef {Object} Transaction
 */

/**
 * Update
 * Only support two level depth
 * @param {Array} params
 * @param {Object} maps
 * @returns {Array}
 */
export function update(params, maps = {}) {
	const keys = Object.keys(maps);
	const ra = (val) => {
		if (typeof val == 'string' && val.startsWith('__')) {
			const [prop, key] = val
				.split('__')
				.join('')
				.toLowerCase()
				.split('.');
			//debug('update', prop, key);
			keys.includes(prop) &&
				((maps[prop] ?? {}).hasOwnProperty(key)
					? (val = maps[prop][key])
					: (val = maps[prop]));
		} else if (Array.isArray(val)) {
			return val.map(ra);
		}
		return val;
	};
	return params.map(ra);
}

//
const methodName = (str) => str.slice(0, str.indexOf('('));

/**
 * Contract call holder
 * @param {string} target
 * @param {string} method
 * @param {Array} params
 * @param {number=} eth
 * @param {Object=} descs
 * @param {Check=} check
 * @param {Array=} uinputs
 * @return {Object}
 */
function Call(
	target,
	method = '',
	params = [],
	eth = '0',
	descs = { title: '', params: [] },
	check = null,
	uinputs = undefined
) {
	// this.constructor === Call
	console.assert(this, 'must-using-new');
	!target && (target = '__target__');
	if (Array.isArray(method))
		method = `${method[0]}(${
			Array.isArray(method[1]) ? method[1].join(',') : method[1]
		})`;
	!descs && (descs = {});
	Object.assign(this, {
		target,
		method,
		params,
		eth,
		descs,
		check,
		uinputs,
		targetName: '',
		fee: '0',
	});
	return this;
}
Call.prototype = Object.freeze({
	name() {
		return methodName(this.method);
	},
	/**
	 * Update
	 * @param {Object|string} maps
	 * @param {Object=} params
	 * @returns {Call}
	 */
	update(maps = {}, params = this.params) {
		// only saved once when updating
		const _params = this.params.slice();
		// fill-in additional inputs
		Object.keys(this.uinputs ?? {}).map(
			(name) =>
				maps[name] === undefined &&
				(maps[name] = this.uinputs[name].default)
		);
		// updates
		params = update(params, maps).map((param) =>
			param instanceof Function ? param(maps, this.target) : param
		);
		const [target, eth] = update([this.target, this.eth], maps);
		const check =
			this.check && this.check.update
				? this.check.update({ ...maps, ...params })
				: null;
		// clone
		return Object.setPrototypeOf(
			{
				...this,
				...(!this._params && { _params }),
				_maps: { ...maps },
				target,
				eth,
				check,
				params,
			},
			Call.prototype
		);
	},
	contract(signer = getSigner(this._maps?.account ?? null)) {
		const [name, nonpay] = [this.name(), this.eth == '0' ? [] : null];
		const params = (
			this.params[0]?.value
				? this.params.map((param) => param.value ?? param)
				: this.params
		).concat(nonpay ?? [{ value: toBN(this.eth) }]);
		const func = `function ${this.method} ${nonpay ?? 'payable'} returns (${
			this.descs.returns ?? ''
		})`;
		const con = contract(this.target, [func]).connect(
			signer ? signer : getProvider()
		);
		con.call = () => con[name].apply(con, params);
		con.probe = () => con.callStatic[name].apply(con, params);
		con.estimate = () => con.estimateGas[name].apply(con, params);
		return con;
	},
	/**
	 * Get metadata of call/target
	 * @return {Call}
	 */
	async meta() {
		//debug('meta', this.target, this.params);
		const con = contract(this.target, 'token');
		const maps = this._maps;
		//
		const trimAddress = (address) =>
			address.slice(0, 8) + '...' + address.slice(-6);
		const printToken = (amount, token = {}) => {
			if (amount.eq(ethers.constants.MaxUint256)) {
				amount = 'MAX';
			} else {
				let d = token.decimals ?? 18;
				state.config.formatHalfDecimals &&
					(d = parseInt(d / 2)) &&
					(amount = amount.div(toPow(d)));
				amount = ethers.utils.formatUnits(amount, d);
			}
			return amount + ' ' + token.symbol;
		};
		const getName = async (target, name = 'name', temp = null) => {
			try {
				target = target.toLowerCase();
				return (
					state.cache.names[target] ??
					(await getToken(target))?.name ??
					(await con.attach(target)[name]())
				);
			} catch (err) {
				return (
					Object.entries(getAddress(null)).find(
						([k, v]) => v == target
					)?.[0] ?? ''
				);
			}
		};
		//
		const isAmount = (param) =>
			(param ?? '')
				.toString()
				.match(/[a-z]?amount[a-z]?[0-9]?|eth|value|in|out/);
		//
		const formatParam = async (val, i) => {
			const orig = val instanceof Object ? Object.assign({}, val) : val;
			const cformat = this.descs.formats?.[i] ?? {};
			if (typeof val === 'string' && val.startsWith('__')) {
				// ? not updated
				val = val.slice(2, val.lastIndexOf('__')).toUpperCase();
			} else if (IA(val)) {
				// ? address
				const name =
					(sameToken(orig, maps.user) && 'YOU') ||
					(sameToken(orig, maps.aggregator) && 'CONTRACT') ||
					(await getName(orig));
				val = trimAddress(val);
				name && (val += ` (${name})`);
				state.config.formatHtml &&
					(val = `<a href="${
						getChain().explorer?.url
					}/address/${orig}">${val}</a>`);
			} else if (isBN(val) || !isNaN(val)) {
				const now = toBN(Date.now()).div(1000);
				if (
					cformat.type == 'amount' ||
					isAmount(this._params[i]) ||
					isBN(this._params[i])
				) {
					const tokens = [];
					// ! assumptions, tokens is reliably
					tokens.push(
						maps.tokens?.[0] ??
							maps.itoken ??
							maps.deposittoken ??
							maps.token ??
							A0
					);
					tokens.push(
						(maps.tokens ?? []).find((e) => e != tokens[0]) ??
							maps.otoken ??
							maps.outputtoken ??
							maps.token ??
							A0
					);
					if (state.config.formatPrevToken) {
						// ! fix for single amount method
						maps._token = cformat.get
							? [await cformat.get(maps)]
							: this.params.filter(
									(address) =>
										IA(address) &&
										!sameToken(address, maps.account) &&
										getToken(address, true)
							  );
						if (
							maps._token.length === 1 &&
							this._params.filter(isAmount).length === 1
						) {
							(maps._token =
								maps._token[0] ??
								maps.token ??
								maps.otoken ??
								maps.outputtoken) &&
								tokens.unshift(maps._token);
						}
					}
					formatParam.acount === undefined &&
						(formatParam.acount = 0);
					//debug('info.token', str([this._params[i], formatParam.tmcount, tokens]));
					// ? token amount
					val = printToken(
						toBN(val),
						await getToken(
							// ? try best
							this.method.startsWith('approve') ||
								this.method.startsWith('transfer')
								? this.target
								: tokens[
										formatParam.acount++ % tokens.length
								  ] ?? null
						)
					);
				} else if (
					toBN(val).gte(now.sub(state.config.formatDatetime ?? 0)) &&
					toBN(val).lte(now.add(state.config.formatDatetime ?? 0))
				) {
					// ? timestamp
					val = new Date(parseInt(val) * 1000).toLocaleString();
				}
			} else if (Array.isArray(val)) {
				// ? recursion
				val = (await Promise.all(val.map(formatParam))).join(', ');
			} else if (true) {
				// ? other
				//debug('!format:', val);
			}
			return val.toString();
		};
		//
		this.targetName = await getName(this.target);
		//
		try {
			this.descs.values = await Promise.all(this.params.map(formatParam));
			//[this.fee, this.probe] = await Promise.all([con.estimate(), con.probe()]);
		} catch (err) {
			debug('!meta', this.method, err.message, err.stack);
		}
		return this;
	},
	/**
	 * Get transaction info
	 * @return {Transaction}
	 */
	get(from = null, nonce = NaN) {
		//const sig = ethers.utils.id(this.method).slice(0, 10);
		//const types = this.method.split(',');
		const data = this.method
			? this.contract(null).interface.encodeFunctionData(
					this.name(),
					this.params
			  )
			: typeof this.params === 'string'
			? ethers.utils.hexlify(ethers.utils.toUtf8Bytes(this.params))
			: '0x';
		return {
			to: this.target,
			data,
			value: toBN(this.eth).toHexString(),
			...(from && { from }),
			...(!isNaN(nonce) && { nonce }),
			chainId: state.chainId,
		};
	},
	encode() {
		return Object.values(this.get()).slice(0, 3);
	},
});

/**
 * View only call holder
 * @param {string} method
 * @param {Array} params
 * @param {string=} returns
 * @param {number|string=} index
 * @param {target=} target
 * @return {Object}
 */
function View(
	method = '',
	params = [],
	returns = 'uint256',
	index = -1,
	target = '__target__'
) {
	console.assert(this, 'must-using-new');
	//if (method instanceof Function) this.get = method;
	Object.assign(this, {
		method,
		params,
		returns,
		index,
		target,
	});
	return this;
}
View.prototype = Object.freeze({
	name() {
		return methodName(this.method);
	},
	update(maps = {}, index = this.index) {
		// clone
		return Object.setPrototypeOf(
			{
				...this,
				_maps: { ...maps },
				index,
				target: update([this.target], maps).shift(),
				params: update(this.params ?? [], maps),
			},
			View.prototype
		);
	},
	contract(address = this.target) {
		return contract(address, [
			`function ${this.method} view returns (${this.returns})`,
		]);
	},
	/**
	 * Get view value
	 * @param {address} target
	 * @param {Object} maps
	 * @return any
	 */
	async get(maps = {}, target = null, detect = false) {
		//const ms = Date.now();
		if (!this.method) {
			return null;
		}
		!target && (target = update([this.target], maps).pop());
		const con = this.contract(target).callStatic;
		const params = update(this.params ?? [], maps ?? {});
		let res = null;
		try {
			res = await con[this.name()].apply(
				con,
				params.concat([state.view.options])
			);
			(this.index instanceof Function && (res = this.index(res))) ||
				(this.index != -1 && (res = res[this.index] ?? res));
			// might
			detect && debug('view', 'hit', target, this.name());
		} catch (err) {
			if (!maps) {
				throw err;
			}
			!detect &&
				debug(
					'!view',
					err.code,
					target,
					this.name(),
					params,
					this.index,
					state.config.debugExtra ? err.stack : ''
				);
		}
		return res;
	},
	encode(address = this.target, maps = {}) {
		return this.method
			? [
					address,
					this.method
						? this.contract(address).interface.encodeFunctionData(
								this.name(),
								update(this.params, maps)
						  )
						: '0x',
					'0',
			  ]
			: [invalidAddresses[0], '0x', '0'];
	},
});

/**
 * Expectation wrapper
 * @param {View} view
 * @param {number} expecting
 * @param {string|Function} value
 * @param {Object.prototype} vtype
 * @return {Object}
 */
function Check(
	view,
	expecting = View.PASS,
	value = '0',
	vtype = ethers.BigNumber,
	last = null
) {
	console.assert(this, 'must-using-new');
	Object.assign(this, {
		view,
		expecting,
		value,
		vtype,
		last,
	});
	this._last();
	return this;
}
Check.prototype = Object.freeze({
	_last() {
		const { view } = this;
		!this.last &&
			view &&
			IA(view.target) &&
			view.params.filter((e) => e && e.startsWith && e.startsWith('__'))
				.length == 0 &&
			[View.INCREASE, View.DECREASE].includes(this.expecting) &&
			(this.last = view.get()) &&
			debug('last', view.target, view.method, view.params);
		return this.last;
	},
	update(maps = {}, value = this.value) {
		if (!this.view?.update) {
			return null;
		}
		// clone
		const obj = Object.setPrototypeOf(
			{
				...this,
				_maps: { ...maps },
				value: update([value], maps).shift(),
				view: this.view.update(maps),
			},
			Check.prototype
		);
		obj._last();
		return obj;
	},
	/**
	 * Evaluate a check/expectation
	 * @param {address=} target
	 * @param {Object=} maps
	 * @return {boolean}
	 */
	async eval(target = this.view?.target, maps = {}) {
		//if (!this.hasOwnProperty('_maps')) { throw new Error('Not updated'); }
		let match = false;
		try {
			this._fetch();
			this.last instanceof Promise && (this.last = await this.last);
			const ret = await this.view.get(maps, target);
			if (ret != null) {
				// currently only bytes32 and bignumber
				switch (this.vtype) {
					default:
				}
				// very primitive
				const n = toBN(ret);
				switch (this.expecting) {
					case View.RANGE:
						this.values = !this.value.length
							? [
									this.value.shr(128),
									this.value.and(
										toBN(
											'0xffffffffffffffffffffffffffffffff'
										)
									),
							  ]
							: this.value;
						match = n.gte(this.values[0]) && n.lte(this.values[1]);
						break;
					case View.EQUAL:
						match = n.eq(this.value) || ret == this.value;
						break;
					case View.INCREASE:
						match =
							this.value == '0'
								? n.gt(last)
								: n.sub(last).eq(this.value);
						break;
					case View.DECREASE:
						match =
							this.value == '0'
								? n.lt(last)
								: n.sub(ret).eq(this.value);
						break;
					case View.MORETHAN:
						match = n.gt(this.value);
						break;
					case View.PASS:
					default:
						match = true;
				}
			} else {
				match = this.expecting == View.FAIL;
			}
		} catch (err) {
			debug('!eval', err.message);
		}
		return match;
	},
	/**
	 * Encode to use in aggregated calls
	 * @return array tuple
	 */
	encode() {
		if (this.view.index < 0) {
			throw new Error('inclusive view can not be encoded');
		}
		// view should be already updated
		return [
			this.view.encode(),
			isFinite(this.expecting) ? this.expecting : View[this.expecting],
			this.value,
			this.view.index,
		];
	},
});
// enum constant = nulls
Object.assign(View, {
	PASS: 0,
	EQUAL: 1,
	INCREASE: 2,
	DECREASE: 3,
	MORETHAN: 4,
	FAIL: 5,
	NOTEQUAL: 6,
	RANGE: 7,
});

export { Call, Check, View };

// Get allowance view
const allowance = (
	token = '__token__',
	owner = '__account__',
	spender = '__to__',
	name = 'allowance'
) =>
	new View(
		name + '(address,address)',
		[owner, spender],
		'uint256',
		-1,
		token
	);
// Get approve call
const approve = (
	token = '__token__',
	spender = '__target__',
	amount = '__amount__',
	name = 'approve',
	check = 'allowance'
) =>
	new Call(
		token,
		name + '(address,uint256)',
		[spender, amount],
		'0',
		{
			title: 'Approve token spending',
			params: ['Spender', 'Amount'],
			approve: true,
			gas: '45500',
		},
		new Check(
			allowance(token, '__account__', spender, check),
			View.EQUAL,
			amount
		)
	);
// Get transfer call
const transfer = (
	token = '__token__',
	to = '__account__',
	amount = '__amount__'
) =>
	new Call(
		token,
		'transfer(address,uint256)',
		[to, amount],
		'0',
		{
			title: 'Transfer token',
			params: ['Receiver', 'Amount'],
			transfer: true,
			gas: '68000',
		},
		new Check(getBalanceView(to, token), View.MORETHAN, amount)
	);

// get ETH balance
const getBalanceEth = (account = '__account__') =>
	new View('balance(address)', [account], ['uint256']).get({}, getAddress());
// get balance view
const getBalanceView = (account = '__account__', token = '__token__') =>
	new View('balanceOf(address)', [account], ['uint256'], -1, token);

// get ERC balance
const getBalance = (account = '__account__', token = A0) =>
	getBalanceView(account, null).get({}, token);

export {
	approve,
	transfer,
	getBalance,
	allowance,
	getBalanceEth,
	getBalanceView,
};

// serilized types
const types = {
	bignumber: ethers.BigNumber.prototype,
	call: Call.prototype,
	view: View.prototype,
	check: Check.prototype,
};

/**
 * Simple object cache
 * @param {Function} get
 * @param {prototype} type
 * @param {string} name
 * @param {number} expire
 * @returns
 */
const cached = async function (
	get = () => null,
	type = Object.prototype,
	name = get.name,
	expire = 7200
) {
	const { cache } = state;
	if (!name) name = get.toString();
	if (name == get.name) name += '()';
	if (cache.user[name] && cache.ts[name] && ts() - cache.ts[name] <= expire) {
		return cache.user[name];
	}
	const value = await get();
	cache.user[name] = value;
	cache.ts[name] = ts();
	// only if value is usable
	if (value && type) {
		Object.setPrototypeOf(
			value,
			typeof type === 'string' ? types[type].prototype : type
		);
	}
	return value;
};

export { types, cached };
