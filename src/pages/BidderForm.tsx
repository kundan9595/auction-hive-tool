import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { User, Wallet, Package, CheckCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QuantityBidForm } from '@/components/QuantityBidForm';

interface Auction {
  id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'active' | 'closed';
  max_budget_per_bidder: number;
}

interface Collection {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
}

interface Item {
  id: string;
  collection_id: string;
  name: string;
  description: string | null;
  starting_bid: number;
  inventory: number;
  sort_order: number;
}

interface ExistingBid {
  id: string;
  item_id: string;
  bid_amount: number;
  quantity_requested: number;
  price_per_unit: number;
  items: {
    name: string;
  };
}

export default function BidderForm() {
  const { slug } = useParams();
  const queryClient = useQueryClient();
  const [bidderName, setBidderName] = useState('');
  const [bidderEmail, setBidderEmail] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);

  // Fetch auction details
  const { data: auction, isLoading: auctionLoading } = useQuery({
    queryKey: ['auction-public', slug],
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

  // Fetch collections and items
  const { data: collections } = useQuery({
    queryKey: ['collections-public', auction?.id],
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

  const { data: items } = useQuery({
    queryKey: ['items-public', auction?.id],
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

  // Fetch existing bids for this bidder
  const { data: existingBids, refetch: refetchBids } = useQuery({
    queryKey: ['bidder-bids', auction?.id, bidderName],
    queryFn: async () => {
      if (!auction?.id || !bidderName) return [];
      const { data, error } = await supabase
        .from('bids')
        .select(`
          id,
          item_id,
          bid_amount,
          quantity_requested,
          price_per_unit,
          items (name)
        `)
        .eq('auction_id', auction.id)
        .eq('bidder_name', bidderName);

      if (error) throw error;
      return data as ExistingBid[];
    },
    enabled: !!auction?.id && !!bidderName && isRegistered,
  });

  // Calculate current budget used
  const currentBudgetUsed = existingBids?.reduce((sum, bid) => sum + bid.bid_amount, 0) || 0;

  // Submit bid mutation
  const submitBidMutation = useMutation({
    mutationFn: async ({ itemId, quantity, pricePerUnit, totalBid }: {
      itemId: string;
      quantity: number;
      pricePerUnit: number;
      totalBid: number;
    }) => {
      // Check if bid already exists for this item and bidder
      const existingBid = existingBids?.find(bid => bid.item_id === itemId);
      
      if (existingBid) {
        // Update existing bid
        const { error } = await supabase
          .from('bids')
          .update({
            bid_amount: totalBid,
            quantity_requested: quantity,
            bidder_email: bidderEmail,
          })
          .eq('id', existingBid.id);
          
        if (error) throw error;
      } else {
        // Create new bid
        const { error } = await supabase
          .from('bids')
          .insert({
            auction_id: auction!.id,
            item_id: itemId,
            bidder_name: bidderName,
            bidder_email: bidderEmail,
            bid_amount: totalBid,
            quantity_requested: quantity,
          });
          
        if (error) throw error;
      }
    },
    onSuccess: () => {
      refetchBids();
      toast({
        title: 'Bid Submitted',
        description: 'Your bid has been submitted successfully!',
      });
    },
    onError: (error) => {
      console.error('Error submitting bid:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit bid. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleBidSubmit = (itemId: string, quantity: number, pricePerUnit: number, totalBid: number) => {
    submitBidMutation.mutate({ itemId, quantity, pricePerUnit, totalBid });
  };

  const handleRegistration = (e: React.FormEvent) => {
    e.preventDefault();
    if (bidderName.trim() && bidderEmail.trim()) {
      setIsRegistered(true);
      toast({
        title: 'Registration Successful',
        description: 'You can now place bids on items.',
      });
    }
  };

  if (auctionLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading auction...</p>
        </div>
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="text-center py-12">
            <h2 className="text-xl font-semibold mb-2">Auction Not Found</h2>
            <p className="text-gray-600">The auction you're looking for doesn't exist.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (auction.status !== 'active') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="text-center py-12">
            <h2 className="text-xl font-semibold mb-2">Auction Not Active</h2>
            <p className="text-gray-600">
              This auction is currently {auction.status}. Bidding is only available when the auction is active.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Auction Header */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl">{auction.name}</CardTitle>
            <CardDescription>
              {auction.description || 'Welcome to this auction'}
            </CardDescription>
            <div className="flex gap-2">
              <Badge className="bg-green-100 text-green-800">Active</Badge>
              <Badge variant="outline">Max Budget: ₹{auction.max_budget_per_bidder}</Badge>
            </div>
          </CardHeader>
        </Card>

        {!isRegistered ? (
          /* Registration Form */
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Register to Bid
              </CardTitle>
              <CardDescription>
                Enter your details to participate in the auction
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRegistration} className="space-y-4">
                <div>
                  <Label htmlFor="bidder-name">Full Name</Label>
                  <Input
                    id="bidder-name"
                    value={bidderName}
                    onChange={(e) => setBidderName(e.target.value)}
                    required
                    placeholder="Enter your full name"
                  />
                </div>
                <div>
                  <Label htmlFor="bidder-email">Email Address</Label>
                  <Input
                    id="bidder-email"
                    type="email"
                    value={bidderEmail}
                    onChange={(e) => setBidderEmail(e.target.value)}
                    required
                    placeholder="Enter your email"
                  />
                </div>
                <Button type="submit" className="w-full">
                  Register and Start Bidding
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Bidder Dashboard */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="w-5 h-5" />
                  Bidding Dashboard
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Bidder</p>
                    <p className="font-medium">{bidderName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Budget</p>
                    <p className="font-medium">₹{auction.max_budget_per_bidder}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Budget Used</p>
                    <p className="font-medium text-blue-600">₹{currentBudgetUsed}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Remaining Budget</p>
                    <p className="font-medium text-green-600">
                      ₹{auction.max_budget_per_bidder - currentBudgetUsed}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Existing Bids Summary */}
            {existingBids && existingBids.length > 0 && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Your Current Bids
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {existingBids.map((bid) => (
                      <div key={bid.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium">{bid.items.name}</p>
                          <p className="text-sm text-gray-600">
                            {bid.quantity_requested} units × ₹{bid.price_per_unit.toFixed(2)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">₹{bid.bid_amount}</p>
                          <Badge variant="outline" className="text-xs">
                            Submitted
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Items by Collection */}
            {collections?.map((collection) => {
              const collectionItems = items?.filter(item => item.collection_id === collection.id) || [];
              
              if (collectionItems.length === 0) return null;

              return (
                <div key={collection.id} className="mb-8">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold">{collection.name}</h3>
                    {collection.description && (
                      <p className="text-gray-600">{collection.description}</p>
                    )}
                    <Separator className="mt-2" />
                  </div>
                  
                  <div className="grid gap-6">
                    {collectionItems.map((item) => (
                      <QuantityBidForm
                        key={item.id}
                        item={item}
                        maxBudget={auction.max_budget_per_bidder}
                        currentBudgetUsed={currentBudgetUsed}
                        onSubmitBid={handleBidSubmit}
                        disabled={submitBidMutation.isPending}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {(!collections || collections.length === 0) && (
              <Card>
                <CardContent className="text-center py-12">
                  <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Items Available</h3>
                  <p className="text-gray-600">There are no items available for bidding at this time.</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
