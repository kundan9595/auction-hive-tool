
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Wallet, TrendingUp, TrendingDown, Trophy, AlertCircle } from 'lucide-react';

interface BidderResultsDisplayProps {
  auctionId: string;
  bidderName: string;
  bidderEmail: string;
}

interface BidderResult {
  id: string;
  item_id: string;
  winning_amount: number;
  quantity_won: number;
  price_per_unit_paid: number;
  original_bid_per_unit: number;
  refund_amount: number;
  item: {
    name: string;
    starting_bid: number;
    collection: {
      name: string;
    };
  };
}

interface BidderBid {
  id: string;
  item_id: string;
  bid_amount: number;
  quantity_requested: number;
  price_per_unit: number;
  item: {
    name: string;
    starting_bid: number;
    inventory: number;
    collection: {
      name: string;
    };
  };
}

export function BidderResultsDisplay({ auctionId, bidderName, bidderEmail }: BidderResultsDisplayProps) {
  const queryClient = useQueryClient();

  console.log('BidderResultsDisplay props:', { auctionId, bidderName, bidderEmail });

  // Fetch bidder's winning results
  const { data: winningResults, isLoading: resultsLoading, error: resultsError } = useQuery({
    queryKey: ['bidder-results', auctionId, bidderName],
    queryFn: async () => {
      console.log('Fetching bidder results for:', { auctionId, bidderName });
      
      const { data, error } = await supabase
        .from('auction_results')
        .select(`
          *,
          item:items!inner(
            name,
            starting_bid,
            collection:collections!inner(name)
          )
        `)
        .eq('auction_id', auctionId)
        .eq('winner_name', bidderName);

      console.log('Bidder results query response:', { data, error });

      if (error) {
        console.error('Error fetching bidder results:', error);
        throw error;
      }
      return data as BidderResult[];
    },
  });

  // Fetch all bidder's bids
  const { data: allBids, isLoading: bidsLoading, error: bidsError } = useQuery({
    queryKey: ['bidder-bids', auctionId, bidderName],
    queryFn: async () => {
      console.log('Fetching bidder bids for:', { auctionId, bidderName });
      
      const { data, error } = await supabase
        .from('bids')
        .select(`
          *,
          item:items!inner(
            name,
            starting_bid,
            inventory,
            collection:collections!inner(name)
          )
        `)
        .eq('auction_id', auctionId)
        .eq('bidder_name', bidderName);

      console.log('Bidder bids query response:', { data, error });

      if (error) {
        console.error('Error fetching bidder bids:', error);
        throw error;
      }
      return data as BidderBid[];
    },
  });

  // Real-time subscription for auction results
  useEffect(() => {
    console.log('Setting up real-time subscription for bidder results');
    
    const channel = supabase
      .channel(`bidder-results-${auctionId}-${bidderName}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'auction_results',
          filter: `auction_id=eq.${auctionId}`,
        },
        (payload) => {
          console.log('Bidder results real-time update:', payload);
          // Invalidate queries to trigger refetch
          queryClient.invalidateQueries({ queryKey: ['bidder-results', auctionId, bidderName] });
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up real-time subscription');
      supabase.removeChannel(channel);
    };
  }, [auctionId, bidderName, queryClient]);

  // Log errors
  useEffect(() => {
    if (resultsError) {
      console.error('Results error:', resultsError);
    }
    if (bidsError) {
      console.error('Bids error:', bidsError);
    }
  }, [resultsError, bidsError]);

  if (resultsLoading || bidsLoading) {
    console.log('Loading bidder results...', { resultsLoading, bidsLoading });
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-gray-200 rounded" />
          <div className="h-48 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  const wonItems = winningResults || [];
  const lostBids = (allBids || []).filter(bid => 
    !wonItems.some(result => result.item_id === bid.item_id)
  );

  console.log('Processed results:', { wonItems, lostBids, totalResults: wonItems.length });

  const totalSpent = wonItems.reduce((sum, result) => sum + result.winning_amount, 0);
  const totalRefund = wonItems.reduce((sum, result) => sum + result.refund_amount, 0);
  const totalBidAmount = (allBids || []).reduce((sum, bid) => sum + bid.bid_amount, 0);
  const totalSaved = totalRefund;

  return (
    <div className="space-y-6">
      {/* Debug Info */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Debug: Found {wonItems.length} winning results and {lostBids.length} lost bids for bidder "{bidderName}" in auction "{auctionId}"
        </AlertDescription>
      </Alert>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Total Spent</p>
                <p className="text-lg font-semibold">₹{totalSpent.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Total Saved</p>
                <p className="text-lg font-semibold text-green-600">₹{totalSaved.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">Items Won</p>
                <p className="text-lg font-semibold">{wonItems.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <div>
                <p className="text-sm text-gray-600">Items Lost</p>
                <p className="text-lg font-semibold">{lostBids.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Won Items */}
      {wonItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-green-600 flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Items You Won ({wonItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Collection</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Your Bid</TableHead>
                  <TableHead>Final Price</TableHead>
                  <TableHead>Refund</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wonItems.map((result) => (
                  <TableRow key={result.id}>
                    <TableCell className="font-medium">{result.item.name}</TableCell>
                    <TableCell>{result.item.collection.name}</TableCell>
                    <TableCell>{result.quantity_won}</TableCell>
                    <TableCell>₹{result.original_bid_per_unit.toLocaleString()}</TableCell>
                    <TableCell>₹{result.price_per_unit_paid.toLocaleString()}</TableCell>
                    <TableCell className="text-green-600">₹{result.refund_amount.toLocaleString()}</TableCell>
                    <TableCell className="font-semibold">₹{result.winning_amount.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Lost Bids */}
      {lostBids.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Items You Didn't Win ({lostBids.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Collection</TableHead>
                  <TableHead>Your Bid</TableHead>
                  <TableHead>Quantity Requested</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lostBids.map((bid) => {
                  const pricePerUnit = bid.bid_amount / bid.quantity_requested;
                  const reason = pricePerUnit < bid.item.starting_bid 
                    ? "Below minimum price" 
                    : "Outbid by others";
                  
                  return (
                    <TableRow key={bid.id}>
                      <TableCell className="font-medium">{bid.item.name}</TableCell>
                      <TableCell>{bid.item.collection.name}</TableCell>
                      <TableCell>₹{pricePerUnit.toLocaleString()}/unit</TableCell>
                      <TableCell>{bid.quantity_requested}</TableCell>
                      <TableCell>
                        <Badge variant={reason === "Below minimum price" ? "destructive" : "secondary"}>
                          {reason}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {wonItems.length === 0 && lostBids.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No results available yet. Results will appear here once the auction is closed.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
