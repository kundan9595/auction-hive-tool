
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { toast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, Filter, Users, TrendingUp } from 'lucide-react';

interface Auction {
  id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'active' | 'closed';
  max_budget_per_bidder: number;
  slug: string;
}

interface Collection {
  id: string;
  name: string;
  description: string | null;
}

interface Item {
  id: string;
  collection_id: string;
  name: string;
  description: string | null;
  starting_bid: number;
  inventory: number;
}

interface Bid {
  id: string;
  auction_id: string;
  item_id: string;
  bidder_name: string;
  bidder_email: string | null;
  bid_amount: number;
  created_at: string;
}

interface BidWithItem extends Bid {
  item: Item;
  collection: Collection;
}

export function MonitorAuction() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [filterCollection, setFilterCollection] = useState<string>('all');
  const [filterBidder, setFilterBidder] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch auction details
  const { data: auction, isLoading: auctionLoading } = useQuery({
    queryKey: ['auction', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auctions')
        .select('*')
        .eq('slug', slug)
        .single();

      if (error) throw error;
      return data as Auction;
    },
  });

  // Fetch collections
  const { data: collections } = useQuery({
    queryKey: ['collections', auction?.id],
    queryFn: async () => {
      if (!auction?.id) return [];
      const { data, error } = await supabase
        .from('collections')
        .select('*')
        .eq('auction_id', auction.id)
        .order('sort_order');

      if (error) throw error;
      return data as Collection[];
    },
    enabled: !!auction?.id,
  });

  // Fetch items
  const { data: items } = useQuery({
    queryKey: ['items', auction?.id],
    queryFn: async () => {
      if (!auction?.id || !collections) return [];
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .in('collection_id', collections.map(c => c.id))
        .order('sort_order');

      if (error) throw error;
      return data as Item[];
    },
    enabled: !!auction?.id && !!collections,
  });

  // Fetch bids with real-time updates
  const { data: bids, refetch: refetchBids } = useQuery({
    queryKey: ['bids', auction?.id],
    queryFn: async () => {
      if (!auction?.id) return [];
      const { data, error } = await supabase
        .from('bids')
        .select('*')
        .eq('auction_id', auction.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Bid[];
    },
    enabled: !!auction?.id,
    refetchInterval: 5000, // Refetch every 5 seconds for live updates
  });

  // Combine bids with item and collection data
  const bidsWithDetails: BidWithItem[] = (bids || []).map(bid => {
    const item = items?.find(i => i.id === bid.item_id);
    const collection = collections?.find(c => c.id === item?.collection_id);
    return {
      ...bid,
      item: item!,
      collection: collection!,
    };
  }).filter(bid => bid.item && bid.collection);

  // Calculate statistics
  const uniqueBidders = new Set(bids?.map(b => b.bidder_name) || []).size;
  const totalBidAmount = bids?.reduce((sum, bid) => sum + bid.bid_amount, 0) || 0;
  const averageBid = bids?.length ? totalBidAmount / bids.length : 0;

  // Calculate budget usage per bidder
  const bidderBudgets = (bids || []).reduce((acc, bid) => {
    if (!acc[bid.bidder_name]) {
      acc[bid.bidder_name] = 0;
    }
    acc[bid.bidder_name] += bid.bid_amount;
    return acc;
  }, {} as Record<string, number>);

  // Filter bids
  const filteredBids = bidsWithDetails.filter(bid => {
    const matchesCollection = filterCollection === 'all' || bid.collection.id === filterCollection;
    const matchesBidder = filterBidder === 'all' || bid.bidder_name === filterBidder;
    const matchesSearch = searchTerm === '' || 
      bid.item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bid.bidder_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesCollection && matchesBidder && matchesSearch;
  });

  // Export to CSV
  const exportToCSV = () => {
    const csvData = filteredBids.map(bid => ({
      'Bidder Name': bid.bidder_name,
      'Bidder Email': bid.bidder_email || '',
      'Collection': bid.collection.name,
      'Item': bid.item.name,
      'Bid Amount': bid.bid_amount,
      'Timestamp': new Date(bid.created_at).toLocaleString(),
    }));

    const csvContent = [
      Object.keys(csvData[0] || {}).join(','),
      ...csvData.map(row => Object.values(row).map(val => `"${val}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auction-${slug}-bids.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (auctionLoading) {
    return (
      <Layout>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="space-y-4">
            <div className="h-48 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!auction) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold">Auction not found</h2>
          <Button onClick={() => navigate('/dashboard')} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Button
              variant="outline"
              onClick={() => navigate(`/auction/${slug}/manage`)}
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Manage
            </Button>
            <h1 className="text-3xl font-bold">Monitor: {auction.name}</h1>
            <p className="text-gray-600 mt-1">Live auction monitoring dashboard</p>
          </div>
          <Badge className={
            auction.status === 'active' ? 'bg-green-100 text-green-800' :
            auction.status === 'draft' ? 'bg-gray-100 text-gray-800' :
            'bg-red-100 text-red-800'
          }>
            {auction.status.charAt(0).toUpperCase() + auction.status.slice(1)}
          </Badge>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">Total Bidders</p>
                  <p className="text-2xl font-bold">{uniqueBidders}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600">Total Bids</p>
                  <p className="text-2xl font-bold">{bids?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div>
                <p className="text-sm text-gray-600">Total Bid Amount</p>
                <p className="text-2xl font-bold">₹{totalBidAmount.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div>
                <p className="text-sm text-gray-600">Average Bid</p>
                <p className="text-2xl font-bold">₹{averageBid.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bidder Budget Usage */}
        <Card>
          <CardHeader>
            <CardTitle>Bidder Budget Usage</CardTitle>
            <CardDescription>How much each bidder has spent from their budget</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(bidderBudgets).map(([bidderName, spent]) => {
                const percentage = (spent / auction.max_budget_per_bidder) * 100;
                return (
                  <div key={bidderName} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{bidderName}</span>
                      <span>₹{spent.toLocaleString()} / ₹{auction.max_budget_per_bidder.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          percentage >= 100 ? 'bg-red-500' : percentage >= 80 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Filters and Bids Table */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Live Bids</CardTitle>
                <CardDescription>Real-time view of all auction bids</CardDescription>
              </div>
              <Button onClick={exportToCSV} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-6">
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4" />
                <Select value={filterCollection} onValueChange={setFilterCollection}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by collection" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Collections</SelectItem>
                    {collections?.map(collection => (
                      <SelectItem key={collection.id} value={collection.id}>
                        {collection.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Select value={filterBidder} onValueChange={setFilterBidder}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by bidder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Bidders</SelectItem>
                  {Object.keys(bidderBudgets).map(bidder => (
                    <SelectItem key={bidder} value={bidder}>
                      {bidder}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                placeholder="Search items or bidders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
            </div>

            {/* Bids Table */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredBids.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No bids found matching the current filters.</p>
              ) : (
                filteredBids.map((bid) => (
                  <div key={bid.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-medium">{bid.bidder_name}</span>
                          <Badge variant="outline" className="text-xs">
                            {bid.collection.name}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">{bid.item.name}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(bid.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-600">₹{bid.bid_amount.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">
                          Budget: ₹{(bidderBudgets[bid.bidder_name] || 0).toLocaleString()} / ₹{auction.max_budget_per_bidder.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
