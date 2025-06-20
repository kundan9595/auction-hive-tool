import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { toast } from '@/hooks/use-toast';
import { Plus, Play, Pause, Share2, ArrowRight, BarChart3, Square, RefreshCw, Edit, Trash2, MoreHorizontal } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BidderStatus } from '@/components/BidderStatus';

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

interface BidderResult {
  bidder_name: string;
  items: Array<{
    item_name: string;
    starting_bid: number;
    quantity_won: number;
    original_bid_per_unit: number;
    price_per_unit_paid: number;
    winning_amount: number;
    refund_amount: number;
  }>;
  total_spent: number;
  total_refund: number;
  budget_remaining: number;
}

interface RemainingItem {
  id: string;
  name: string;
  starting_bid: number;
  inventory: number;
  remaining_quantity: number;
  collection_name: string;
}

export function ManageAuction() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCollectionForm, setShowCollectionForm] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [editingAuction, setEditingAuction] = useState(false);

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

  // Fetch auction results for closed auctions
  const { data: auctionResults } = useQuery({
    queryKey: ['auction-results', auction?.id],
    queryFn: async () => {
      if (!auction?.id || auction.status !== 'closed') return null;
      
      const { data, error } = await supabase
        .from('auction_results')
        .select(`
          *,
          items (name, starting_bid),
          bids (bidder_name)
        `)
        .eq('auction_id', auction.id);

      if (error) throw error;
      return data;
    },
    enabled: !!auction?.id && auction?.status === 'closed',
  });

  // Fetch all bidders for this auction
  const { data: allBidders } = useQuery({
    queryKey: ['all-bidders', auction?.id],
    queryFn: async () => {
      if (!auction?.id || auction.status !== 'closed') return [];
      
      const { data, error } = await supabase
        .from('bids')
        .select('bidder_name')
        .eq('auction_id', auction.id);

      if (error) throw error;
      
      // Get unique bidder names
      const uniqueBidders = [...new Set(data.map(bid => bid.bidder_name))];
      return uniqueBidders;
    },
    enabled: !!auction?.id && auction?.status === 'closed',
  });

  // Process results to get bidder-wise summary with quantity and refunds
  const bidderResults: BidderResult[] = auction?.status === 'closed' && auctionResults && allBidders ? 
    allBidders.map(bidderName => {
      const bidderWins = auctionResults.filter(result => result.winner_name === bidderName);
      
      const items = bidderWins.map(result => ({
        item_name: result.items.name,
        starting_bid: result.items.starting_bid,
        quantity_won: result.quantity_won || 1,
        original_bid_per_unit: result.original_bid_per_unit || 0,
        price_per_unit_paid: result.price_per_unit_paid || 0,
        winning_amount: result.winning_amount || 0,
        refund_amount: result.refund_amount || 0,
      }));
      
      const totalSpent = bidderWins.reduce((sum, result) => sum + (result.winning_amount || 0), 0);
      const totalRefund = bidderWins.reduce((sum, result) => sum + (result.refund_amount || 0), 0);
      
      return {
        bidder_name: bidderName,
        items,
        total_spent: totalSpent,
        total_refund: totalRefund,
        budget_remaining: auction!.max_budget_per_bidder - totalSpent + totalRefund,
      };
    })
  : [];

  // Get remaining items with remaining quantities
  const remainingItems: RemainingItem[] = auction?.status === 'closed' && items && auctionResults ? 
    items.map(item => {
      const soldQuantity = auctionResults
        .filter(result => result.item_id === item.id)
        .reduce((sum, result) => sum + (result.quantity_sold || 0), 0);
      
      const remainingQuantity = item.inventory - soldQuantity;
      
      if (remainingQuantity > 0) {
        return {
          id: item.id,
          name: item.name,
          starting_bid: item.starting_bid,
          inventory: item.inventory,
          remaining_quantity: remainingQuantity,
          collection_name: collections?.find(c => c.id === item.collection_id)?.name || 'Unknown',
        };
      }
      return null;
    }).filter(Boolean) as RemainingItem[]
  : [];

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

      // If closing auction, generate results using the new function
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

  // Generate auction results using the new average pricing function
  const generateAuctionResults = async () => {
    if (!auction?.id) return;

    try {
      // Call the new database function for average pricing calculation
      const { error } = await supabase.rpc('calculate_average_auction_results', {
        auction_id_param: auction.id
      });

      if (error) throw error;

      toast({
        title: 'Auction Closed',
        description: 'Results have been generated with average pricing.',
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

  // Reset auction mutation - completely wipe everything
  const resetAuctionMutation = useMutation({
    mutationFn: async () => {
      if (!auction?.id) return;

      console.log('Starting complete auction reset...');

      // Delete all auction results first
      const { error: resultsError } = await supabase
        .from('auction_results')
        .delete()
        .eq('auction_id', auction.id);

      if (resultsError) {
        console.error('Error deleting auction results:', resultsError);
        throw resultsError;
      }

      // Delete all bids
      const { error: bidsError } = await supabase
        .from('bids')
        .delete()
        .eq('auction_id', auction.id);

      if (bidsError) {
        console.error('Error deleting bids:', bidsError);
        throw bidsError;
      }

      // Generate a new slug for the auction to create a fresh bidding link
      const newSlug = `${auction.slug}-${Date.now()}`;

      // Reset auction to draft status with new slug and clear closed_at
      const { error: auctionError } = await supabase
        .from('auctions')
        .update({ 
          status: 'draft',
          slug: newSlug,
          closed_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', auction.id);

      if (auctionError) {
        console.error('Error updating auction:', auctionError);
        throw auctionError;
      }

      console.log('Auction reset completed successfully with new slug:', newSlug);
      
      // Navigate to the new slug
      navigate(`/auction/${newSlug}/manage`, { replace: true });
    },
    onSuccess: () => {
      // Clear all cached data
      queryClient.invalidateQueries({ queryKey: ['auction'] });
      queryClient.invalidateQueries({ queryKey: ['auction-results'] });
      queryClient.invalidateQueries({ queryKey: ['all-bidders'] });
      queryClient.invalidateQueries({ queryKey: ['bids'] });
      
      toast({
        title: 'Auction Reset Successfully',
        description: 'Auction has been completely reset with a new bidding link. All previous data has been cleared.',
      });
    },
    onError: (error) => {
      console.error('Error resetting auction:', error);
      toast({
        title: 'Error',
        description: 'Failed to reset auction. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Edit auction mutation
  const editAuctionMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const name = formData.get('name') as string;
      const description = formData.get('description') as string;
      const maxBudget = parseFloat(formData.get('maxBudget') as string);

      const { error } = await supabase
        .from('auctions')
        .update({
          name,
          description: description || null,
          max_budget_per_bidder: maxBudget,
          updated_at: new Date().toISOString(),
        })
        .eq('id', auction!.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auction', slug] });
      setEditingAuction(false);
      toast({
        title: 'Auction Updated',
        description: 'Auction details have been updated successfully.',
      });
    },
  });

  // Delete auction mutation
  const deleteAuctionMutation = useMutation({
    mutationFn: async () => {
      // Delete in order: auction_results, bids, items, collections, auction
      if (auction?.id) {
        await supabase.from('auction_results').delete().eq('auction_id', auction.id);
        await supabase.from('bids').delete().eq('auction_id', auction.id);
        
        if (collections?.length) {
          const collectionIds = collections.map(c => c.id);
          await supabase.from('items').delete().in('collection_id', collectionIds);
        }
        
        await supabase.from('collections').delete().eq('auction_id', auction.id);
        
        const { error } = await supabase.from('auctions').delete().eq('id', auction.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: 'Auction Deleted',
        description: 'Auction and all related data have been deleted.',
      });
      navigate('/dashboard');
    },
  });

  // Edit collection mutation
  const editCollectionMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; description: string }) => {
      const { error } = await supabase
        .from('collections')
        .update({
          name: data.name,
          description: data.description || null,
        })
        .eq('id', data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections', auction?.id] });
      setEditingCollection(null);
      toast({
        title: 'Collection Updated',
        description: 'Collection has been updated successfully.',
      });
    },
  });

  // Delete collection mutation
  const deleteCollectionMutation = useMutation({
    mutationFn: async (collectionId: string) => {
      // Delete items first, then collection
      await supabase.from('items').delete().eq('collection_id', collectionId);
      
      const { error } = await supabase
        .from('collections')
        .delete()
        .eq('id', collectionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections', auction?.id] });
      queryClient.invalidateQueries({ queryKey: ['items', auction?.id] });
      toast({
        title: 'Collection Deleted',
        description: 'Collection and all its items have been deleted.',
      });
    },
  });

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
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-2xl">{auction.name}</CardTitle>
                  
                  <Dialog open={editingAuction} onOpenChange={setEditingAuction}>
                    <DialogTrigger asChild>
                      <Button 
                        size="sm" 
                        variant="outline"
                        disabled={auction.status === 'active'}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit Auction</DialogTitle>
                        <DialogDescription>
                          Update auction details. Cannot edit while auction is active.
                        </DialogDescription>
                      </DialogHeader>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          editAuctionMutation.mutate(new FormData(e.currentTarget));
                        }}
                        className="space-y-4"
                      >
                        <div>
                          <Label htmlFor="edit-name">Auction Name</Label>
                          <Input 
                            id="edit-name" 
                            name="name" 
                            defaultValue={auction.name}
                            required 
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-description">Description</Label>
                          <Textarea 
                            id="edit-description" 
                            name="description" 
                            defaultValue={auction.description || ''}
                            rows={3}
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-maxBudget">Max Budget per Bidder (₹)</Label>
                          <Input 
                            id="edit-maxBudget" 
                            name="maxBudget" 
                            type="number"
                            min="1"
                            step="0.01"
                            defaultValue={auction.max_budget_per_bidder}
                            required 
                          />
                        </div>
                        <DialogFooter>
                          <Button type="submit" disabled={editAuctionMutation.isPending}>
                            {editAuctionMutation.isPending ? 'Updating...' : 'Update Auction'}
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        disabled={auction.status === 'active'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Auction</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the auction and ALL related data including collections, items, bids, and results. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteAuctionMutation.mutate()}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Delete Auction
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

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
                
                {auction.status === 'closed' && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="flex items-center space-x-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                        disabled={resetAuctionMutation.isPending}
                      >
                        <RefreshCw className={`w-4 h-4 ${resetAuctionMutation.isPending ? 'animate-spin' : ''}`} />
                        <span>Complete Reset & Fresh Start</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Complete Auction Reset</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will completely reset the auction and create a fresh start:
                          <br />• All bids will be permanently deleted
                          <br />• All auction results will be cleared
                          <br />• A new bidding link will be generated
                          <br />• Auction status will return to draft
                          <br /><br />
                          This action cannot be undone and will make it like a brand new auction.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => resetAuctionMutation.mutate()}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          Reset Everything
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
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

        {/* Bidder Status - Show only when auction is draft or active */}
        {(auction.status === 'draft' || auction.status === 'active') && (
          <BidderStatus auctionId={auction.id} auctionStatus={auction.status} />
        )}

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
                  <Card key={collection.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div 
                          className="flex-1 cursor-pointer"
                          onClick={() => navigate(`/auction/${slug}/collection/${collection.id}`)}
                        >
                          <h4 className="font-medium">{collection.name}</h4>
                          {collection.description && (
                            <p className="text-sm text-gray-600 mt-1">{collection.description}</p>
                          )}
                          <p className="text-xs text-gray-500 mt-2">
                            {collectionItemCount} items
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-1 ml-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/auction/${slug}/collection/${collection.id}`)}
                          >
                            <ArrowRight className="w-4 h-4" />
                          </Button>

                          <Dialog open={editingCollection?.id === collection.id} onOpenChange={(open) => setEditingCollection(open ? collection : null)}>
                            <DialogTrigger asChild>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                disabled={auction.status === 'closed'}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Edit Collection</DialogTitle>
                                <DialogDescription>
                                  Update collection details.
                                </DialogDescription>
                              </DialogHeader>
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  const formData = new FormData(e.currentTarget);
                                  editCollectionMutation.mutate({
                                    id: collection.id,
                                    name: formData.get('name') as string,
                                    description: formData.get('description') as string,
                                  });
                                }}
                                className="space-y-4"
                              >
                                <div>
                                  <Label htmlFor="edit-collection-name">Collection Name</Label>
                                  <Input 
                                    id="edit-collection-name" 
                                    name="name" 
                                    defaultValue={collection.name}
                                    required 
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="edit-collection-description">Description</Label>
                                  <Textarea 
                                    id="edit-collection-description" 
                                    name="description" 
                                    defaultValue={collection.description || ''}
                                    rows={2}
                                  />
                                </div>
                                <DialogFooter>
                                  <Button type="submit" disabled={editCollectionMutation.isPending}>
                                    {editCollectionMutation.isPending ? 'Updating...' : 'Update Collection'}
                                  </Button>
                                </DialogFooter>
                              </form>
                            </DialogContent>
                          </Dialog>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                disabled={auction.status === 'closed'}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Collection</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete "{collection.name}" and all its items. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteCollectionMutation.mutate(collection.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Delete Collection
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
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

        {/* Auction Results - Show only when auction is closed with new quantity and refund display */}
        {auction.status === 'closed' && (
          <>
            {/* All Bidders Results Card - Updated for quantity-based results */}
            <Card>
              <CardHeader>
                <CardTitle>Auction Results - Quantity-Based with Average Pricing</CardTitle>
                <CardDescription>
                  Complete summary showing quantities won, average pricing, and refunds for all participants
                </CardDescription>
              </CardHeader>
              <CardContent>
                {bidderResults.length > 0 ? (
                  <div className="space-y-6">
                    {bidderResults.map((bidder) => (
                      <div key={bidder.bidder_name} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center space-x-3">
                            <h4 className="font-semibold text-lg">{bidder.bidder_name}</h4>
                            {bidder.items.length === 0 && (
                              <Badge variant="outline" className="text-gray-600">
                                No Items Won
                              </Badge>
                            )}
                            {bidder.items.length > 0 && (
                              <Badge className="bg-green-100 text-green-800">
                                {bidder.items.reduce((sum, item) => sum + item.quantity_won, 0)} Units Won
                              </Badge>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-600">Total Spent: ₹{bidder.total_spent.toFixed(2)}</p>
                            <p className="text-sm text-green-600">Total Refund: ₹{bidder.total_refund.toFixed(2)}</p>
                            <p className="text-sm text-gray-600">Budget Remaining: ₹{bidder.budget_remaining.toFixed(2)}</p>
                          </div>
                        </div>
                        
                        {bidder.items.length > 0 ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Item Name</TableHead>
                                <TableHead>Qty Won</TableHead>
                                <TableHead>Original Bid/Unit</TableHead>
                                <TableHead>Paid/Unit (Avg)</TableHead>
                                <TableHead>Total Paid</TableHead>
                                <TableHead>Refund</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {bidder.items.map((item, index) => (
                                <TableRow key={index}>
                                  <TableCell>{item.item_name}</TableCell>
                                  <TableCell>{item.quantity_won}</TableCell>
                                  <TableCell>₹{item.original_bid_per_unit.toFixed(2)}</TableCell>
                                  <TableCell>₹{item.price_per_unit_paid.toFixed(2)}</TableCell>
                                  <TableCell>₹{item.winning_amount.toFixed(2)}</TableCell>
                                  <TableCell className="text-green-600">₹{item.refund_amount.toFixed(2)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) : (
                          <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-lg">
                            <p className="text-sm">This bidder did not win any items in this auction.</p>
                            <p className="text-xs mt-1">Full budget of ₹{auction.max_budget_per_bidder} remains unused.</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">
                    No bidders participated in this auction.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Remaining Items Card - Updated to show remaining quantities */}
            <Card>
              <CardHeader>
                <CardTitle>Remaining Items</CardTitle>
                <CardDescription>
                  Items with remaining quantities after the auction
                </CardDescription>
              </CardHeader>
              <CardContent>
                {remainingItems.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item Name</TableHead>
                        <TableHead>Collection</TableHead>
                        <TableHead>Starting Bid/Unit</TableHead>
                        <TableHead>Total Inventory</TableHead>
                        <TableHead>Remaining Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {remainingItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.name}</TableCell>
                          <TableCell>{item.collection_name}</TableCell>
                          <TableCell>₹{item.starting_bid}</TableCell>
                          <TableCell>{item.inventory}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-orange-600">
                              {item.remaining_quantity}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-gray-500 text-center py-8">
                    All items were successfully auctioned off!
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
