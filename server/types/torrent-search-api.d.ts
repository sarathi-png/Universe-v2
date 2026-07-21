declare module "torrent-search-api" {
  interface TorrentSearchResult {
    title: string;
    name?: string;
    magnet: string;
    seeds: number;
    peers: number;
    size: string;
    provider?: string;
    [key: string]: any;
  }

  interface TSApi {
    enableProvider(name: string): void;
    disableProvider(name: string): void;
    getActiveProviders(): string[];
    search(
      query: string,
      category?: string,
      limit?: number
    ): Promise<TorrentSearchResult[]>;
  }

  const TSA: TSApi;
  export default TSA;
}
