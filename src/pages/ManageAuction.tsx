
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { toast } from '@/hooks/use-toast';
import { Plus, Play, Pause, Share2, ArrowRight, BarChart3, Square } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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

interface Auction {
  id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'active' | 'closed';
  max_budget_per_bidder: number;
  slug: string;
}

export function ManageAuction() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCollectionForm, setShowCollectionForm] = useState(false);

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

  // Fetch items for counting
  const { data: items } = useQuery({
    queryKey: ['items', auction?.id],
    queryFn: async () => {
      if (!auction?.id) return [];
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .in('collection_id', collections?.map(c => c.id) || [])
        .order('sort_order');

      if (error) throw error;
      return data as Item[];
    },
    enabled: !!auction?.id && !!collections,
  });

  // Toggle auction status
  const toggleStatusMutation = useMutation({
    mutationFn: async (newStatus: 'draft' | 'active' | 'closed') => {
      const updateData: any = { 
        status: newStatus,
        updated_at: new Date().toISOString(),
      };
      
      if (newStatus === 'closed') {
        updateData.closed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('auctions')
        .update(updateData)
        .eq('id', auction!.id);

      if (error) throw error;

      // If closing auction, generate results
      if (newStatus === 'closed') {
        await generateAuctionResults();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auction', slug] });
      toast({
        title: 'Status Updated',
        description: `Auction has been ${auction?.status === 'active' ? 'paused' : auction?.status === 'draft' ? 'started' : 'closed'}.`,
      });
    },
  });

  // Generate auction results when closing
  const generateAuctionResults = async () => {
    if (!auction?.id) return;

    try {
      // Get all bids for this auction
      const { data: bids, error: bidsError } = await supabase
        .from('bids')
        .select('*')
        .eq('auction_id', auction.id);

      if (bidsError) throw bidsError;

      // Group bids by item and find highest bidder for each
      const itemBids = bids?.reduce((acc, bid) => {
        if (!acc[bid.item_id]) {
          acc[bid.item_id] = [];
        }
        acc[bid.item_id].push(bid);
        return acc;
      }, {} as Record<string, any[]>);

      // Generate results for each item
      const results = Object.entries(itemBids || {}).map(([itemId, itemBidList]) => {
        // Sort by bid amount (highest first)
        const sortedBids = itemBidList.sort((a, b) => b.bid_amount - a.bid_amount);
        const winningBid = sortedBids[0];

        return {
          auction_id: auction.id,
          item_id: itemId,
          winning_bid_id: winningBid.id,
          winner_name: winningBid.bidder_name,
          winning_amount: winningBid.bid_amount,
          quantity_sold: 1, // For now, assuming quantity 1 per winner
        };
      });

      if (results.length > 0) {
        const { error: resultsError } = await supabase
          .from('auction_results')
          .upsert(results, {
            onConflict: 'auction_id,item_id',
          });

        if (resultsError) throw resultsError;
      }

      toast({
        title: 'Auction Closed',
        description: 'Results have been generated successfully.',
      });
    } catch (error) {
      console.error('Error generating auction results:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate auction results.',
        variant: 'destructive',
      });
    }
  };

  // Add collection
  const addCollectionMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const name = formData.get('name') as string;
      const description = formData.get('description') as string;

      const { error } = await supabase
        .from('collections')
        .insert({
          auction_id: auction!.id,
          name,
          description: description || null,
          sort_order: (collections?.length || 0) + 1,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections', auction?.id] });
      setShowCollectionForm(false);
      toast({
        title: 'Collection Added',
        description: 'New collection has been created successfully.',
      });
    },
  });

  const copyBidLink = () => {
    const bidUrl = `${window.location.origin}/auction/${slug}/bid`;
    navigator.clipboard.writeText(bidUrl);
    toast({
      title: 'Link Copied!',
      description: 'Bidding link has been copied to clipboard.',
    });
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
        {/* Auction Header */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl">{auction.name}</CardTitle>
                <CardDescription className="mt-2">
                  {auction.description || 'No description provided'}
                </CardDescription>
              </div>
              <Badge className={
                auction.status === 'active' ? 'bg-green-100 text-green-800' :
                auction.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                'bg-red-100 text-red-800'
              }>
                {auction.status.charAt(0).toUpperCase() + auction.status.slice(1)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="text-sm">
                <span className="text-gray-600">Max Budget:</span>
                <span className="font-medium ml-1">₹{auction.max_budget_per_bidder}</span>
              </div>
              
              <div className="flex space-x-2 ml-auto">
                {auction.status === 'draft' && (
                  <Button
                    onClick={() => toggleStatusMutation.mutate('active')}
                    className="flex items-center space-x-2"
                  >
                    <Play className="w-4 h-4" />
                    <span>Start Auction</span>
                  </Button>
                )}
                
                {auction.status === 'active' && (
                  <>
                    <Button
                      onClick={() => toggleStatusMutation.mutate('draft')}
                      variant="outline"
                      className="flex items-center space-x-2"
                    >
                      <Pause className="w-4 h-4" />
                      <span>Pause Auction</span>
                    </Button>
                    
                    <Button
                      onClick={() => toggleStatusMutation.mutate('closed')}
                      variant="destructive"
                      className="flex items-center space-x-2"
                    >
                      <Square className="w-4 h-4" />
                      <span>Close Auction</span>
                    </Button>
                  </>
                )}
                
                {auction.status === 'active' && (
                  <Button
                    onClick={() => navigate(`/auction/${slug}/monitor`)}
                    variant="outline"
                    className="flex items-center space-x-2"
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span>Monitor</span>
                  </Button>
                )}
                
                <Button
                  onClick={copyBidLink}
                  variant="outline"
                  className="flex items-center space-x-2"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Copy Bid Link</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Collections Management */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Collections</CardTitle>
              <Button
                size="sm"
                onClick={() => setShowCollectionForm(true)}
                disabled={auction.status === 'closed'}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Collection
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {showCollectionForm && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addCollectionMutation.mutate(new FormData(e.currentTarget));
                }}
                className="space-y-4 mb-4 p-4 border rounded-lg bg-gray-50"
              >
                <div>
                  <Label htmlFor="name">Collection Name</Label>
                  <Input id="name" name="name" required />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" name="description" rows={2} />
                </div>
                <div className="flex space-x-2">
                  <Button type="submit" size="sm">Add</Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowCollectionForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {collections?.map((collection) => {
                const collectionItemCount = items?.filter(i => i.collection_id === collection.id).length || 0;
                
                return (
                  <Card
                    key={collection.id}
                    className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => navigate(`/auction/${slug}/collection/${collection.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-medium">{collection.name}</h4>
                          {collection.description && (
                            <p className="text-sm text-gray-600 mt-1">{collection.description}</p>
                          )}
                          <p className="text-xs text-gray-500 mt-2">
                            {collectionItemCount} items
                          </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            
            {!collections?.length && (
              <p className="text-gray-500 text-center py-8">
                No collections yet. Add one to get started with your auction items.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
