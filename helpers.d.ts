/**
 * helper functions
 */
export function contract(address: any, abi?: string): ethers.ethers.Contract;
/**
 * Return valid swap path and expected out amounts
 * @param {*} router
 * @param {*} from
 * @param {*} to
 * @param {*} amount
 * @param {*} final
 * @returns
 */
export function findSwapPath(router: any, from: any, to: any, amount?: any, final?: any): any;
export function findSwapPair(router: any, token: any, otoken: any): Promise<any>;
export function findContract(target: any, type?: string, maps?: {}): Promise<any>;
import * as ethers from "ethers";
export function ts(): number;
export const invalidTokens: string[];
export const toBN: typeof ethers.ethers.BigNumber.from;
export const isBN: typeof ethers.ethers.BigNumber.isBigNumber;
export function parseAmount(amount: any, token?: any): Promise<ethers.ethers.BigNumber>;
export function getDecimals(token: any): any;
export function getABI(name: any): any;
export function getChain(id?: string | number): {
    name: string;
    chainId: number;
    shortName: string;
    networkId: number;
    nativeCurrency: {
        name: string;
        symbol: string;
        decimals: number;
    };
    rpc: string[];
    faucets: string[];
    infoURL: string;
    archive?: undefined;
    explorer?: undefined;
} | {
    name: string;
    chainId: number;
    shortName: string;
    networkId: number;
    nativeCurrency: {
        name: string;
        symbol: string;
        decimals: number;
    };
    rpc: string[];
    faucets: string[];
    infoURL: string;
    archive: string[];
    explorer: {
        api_url: string;
        api_key: string;
    };
};
export function getAddress(name?: string, id?: string | number): any;
export function getToken(address?: string): any;
export function getProvider(id?: string | number): any;
export function getSigner(id?: number): ethers.ethers.Wallet;
export function getScanApi(maps?: {}, id?: string | number): string;
export namespace types {
    const bignumber: typeof ethers.ethers.BigNumber;
}
export function cached(get?: () => any, type?: Object, name?: string, expire?: number): Promise<any>;
export function debug(...args: any[]): void;
export function serialize(obj: any): string;
