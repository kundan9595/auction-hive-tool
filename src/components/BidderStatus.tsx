
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Users, Activity } from 'lucide-react';

interface BidderInfo {
  bidder_name: string;
  bidder_email?: string;
  status: 'bidding' | 'complete';
  total_bids: number;
  total_bid_amount: number;
  last_bid_time: string;
  items_bid_on: number;
  registered_at: string;
  completed_at?: string;
}

interface BidderStatusProps {
  auctionId: string;
  auctionStatus: 'draft' | 'active' | 'closed';
}

export function BidderStatus({ auctionId, auctionStatus }: BidderStatusProps) {
  const [bidders, setBidders] = useState<BidderInfo[]>([]);

  // Fetch bidder registrations and bids
  const { data: registrationData, refetch: refetchRegistrations } = useQuery({
    queryKey: ['bidder-registrations', auctionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bidder_registrations')
        .select('*')
        .eq('auction_id', auctionId)
        .order('registered_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!auctionId && auctionStatus === 'active',
    refetchInterval: auctionStatus === 'active' ? 5000 : false,
  });

  // Fetch bidder information from bids
  const { data: bidderData, refetch: refetchBids } = useQuery({
    queryKey: ['bidder-status', auctionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bids')
        .select('bidder_name, bidder_email, bid_amount, created_at, item_id')
        .eq('auction_id', auctionId);

      if (error) throw error;
      return data;
    },
    enabled: !!auctionId && auctionStatus === 'active',
    refetchInterval: auctionStatus === 'active' ? 5000 : false,
  });

  useEffect(() => {
    if (registrationData && bidderData) {
      // Create map of bid stats by bidder
      const bidStatsMap = new Map<string, {
        total_bids: number;
        total_bid_amount: number;
        items_bid_on: number;
        last_bid_time: string;
      }>();

      bidderData.forEach(bid => {
        const existing = bidStatsMap.get(bid.bidder_name);
        
        if (existing) {
          existing.total_bids += 1;
          existing.total_bid_amount += Number(bid.bid_amount);
          existing.items_bid_on = new Set([...existing.items_bid_on.toString().split(','), bid.item_id]).size;
          
          if (new Date(bid.created_at) > new Date(existing.last_bid_time)) {
            existing.last_bid_time = bid.created_at;
          }
        } else {
          bidStatsMap.set(bid.bidder_name, {
            total_bids: 1,
            total_bid_amount: Number(bid.bid_amount),
            last_bid_time: bid.created_at,
            items_bid_on: 1,
          });
        }
      });

      // Combine registration data with bid stats
      const combinedData = registrationData.map(registration => {
        const bidStats = bidStatsMap.get(registration.bidder_name) || {
          total_bids: 0,
          total_bid_amount: 0,
          items_bid_on: 0,
          last_bid_time: registration.registered_at,
        };

        return {
          bidder_name: registration.bidder_name,
          bidder_email: registration.bidder_email,
          status: registration.status as 'bidding' | 'complete',
          registered_at: registration.registered_at,
          completed_at: registration.completed_at,
          ...bidStats,
        };
      });

      setBidders(combinedData);
    }
  }, [registrationData, bidderData]);

  // Set up real-time subscriptions for active auctions
  useEffect(() => {
    if (auctionStatus !== 'active') return;

    const registrationsChannel = supabase
      .channel('bidder-registrations-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bidder_registrations',
          filter: `auction_id=eq.${auctionId}`,
        },
        () => {
          refetchRegistrations();
        }
      )
      .subscribe();

    const bidsChannel = supabase
      .channel('bidder-bids-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bids',
          filter: `auction_id=eq.${auctionId}`,
        },
        () => {
          refetchBids();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(registrationsChannel);
      supabase.removeChannel(bidsChannel);
    };
  }, [auctionId, auctionStatus, refetchRegistrations, refetchBids]);

  if (auctionStatus === 'closed') {
    return null; // Hide when auction is closed
  }

  if (auctionStatus === 'draft') {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Bidder activity will appear here once the auction starts.</p>
        </CardContent>
      </Card>
    );
  }

  const getTimeSince = (timestamp: string) => {
    const now = new Date();
    const bidTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - bidTime.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const getActivityStatus = (lastBidTime: string, status: string) => {
    if (status === 'complete') return 'complete';
    
    const now = new Date();
    const bidTime = new Date(lastBidTime);
    const diffInMinutes = Math.floor((now.getTime() - bidTime.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 5) return 'active';
    if (diffInMinutes < 30) return 'recent';
    return 'idle';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Active Bidders ({bidders.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {bidders.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No bidders have joined yet.</p>
            <p className="text-sm text-gray-500 mt-1">Waiting for first registration...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bidder</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total Bids</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total Amount</TableHead>
                  <TableHead>Last Activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bidders.map((bidder) => {
                  const activityStatus = getActivityStatus(bidder.last_bid_time, bidder.status);
                  
                  return (
                    <TableRow key={bidder.bidder_name}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{bidder.bidder_name}</p>
                          {bidder.bidder_email && (
                            <p className="text-xs text-gray-500">{bidder.bidder_email}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={
                            activityStatus === 'complete' ? 'bg-green-100 text-green-800' :
                            activityStatus === 'active' ? 'bg-blue-100 text-blue-800' :
                            activityStatus === 'recent' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-600'
                          }
                        >
                          {activityStatus === 'complete' ? 'Complete' :
                           activityStatus === 'active' ? 'Active' :
                           activityStatus === 'recent' ? 'Recent' :
                           'Bidding'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{bidder.total_bids}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{bidder.items_bid_on} items</Badge>
                      </TableCell>
                      <TableCell>₹{bidder.total_bid_amount.toFixed(2)}</TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {getTimeSince(bidder.last_bid_time)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
