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
import { Plus, Play, Pause, Share2, ArrowRight, BarChart3, Square, RefreshCw, Edit, Trash2, MoreHorizontal, Calculator } from 'lucide-react';
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
    collection_name: string;
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
  // New fields for complete bid tracking
  total_bids_placed: number;
  total_winning_bids: number;
  total_lost_bids: number;
  lost_bids: Array<{
    item_name: string;
    collection_name: string;
    bid_amount: number;
    quantity_requested: number;
    price_per_unit: number;
    reason: string;
    additionalInfo: string;
    starting_bid: number;
  }>;
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

  // Fetch ALL bids for this auction (not just winning ones)
  const { data: allBids } = useQuery({
    queryKey: ['all-bids', auction?.id],
    queryFn: async () => {
      if (!auction?.id || auction.status !== 'closed') return [];
      
      const { data, error } = await supabase
        .from('bids')
        .select(`
          *,
          items (
            id,
            name,
            starting_bid,
            inventory,
            collection_id,
            collections (name)
          )
        `)
        .eq('auction_id', auction.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!auction?.id && auction?.status === 'closed',
  });

  // Enhanced bidder results processing with complete bid information
  const bidderResults: BidderResult[] = auction?.status === 'closed' && auctionResults && allBidders && items && collections && allBids ? 
    allBidders.map(bidderName => {
      const bidderWins = auctionResults.filter(result => result.winner_name === bidderName);
      const bidderAllBids = allBids.filter(bid => bid.bidder_name === bidderName);
      
      const bidderItems = bidderWins.map(result => {
        const item = items.find(item => item.id === result.item_id);
        const collection = collections.find(c => c.id === item?.collection_id);
        
        return {
          collection_name: collection?.name || 'Unknown Collection',
          item_name: result.items.name,
          starting_bid: result.items.starting_bid,
          quantity_won: result.quantity_won || 1,
          original_bid_per_unit: result.original_bid_per_unit || 0,
          price_per_unit_paid: result.price_per_unit_paid || 0,
          winning_amount: result.winning_amount || 0,
          refund_amount: result.refund_amount || 0,
        };
      });
      
      // Calculate total bids placed (all bids by this bidder)
      const totalBidsPlaced = bidderAllBids.reduce((sum, bid) => sum + bid.bid_amount, 0);
      
      // Calculate winning bids total (using original bid amounts from results)
      const totalWinningBids = bidderWins.reduce((sum, result) => 
        sum + ((result.original_bid_per_unit || 0) * (result.quantity_won || 1)), 0);
      
      // Calculate lost bids
      const totalLostBids = totalBidsPlaced - totalWinningBids;
      
      // Calculate refunds
      const totalRefund = bidderWins.reduce((sum, result) => sum + (result.refund_amount || 0), 0);
      
      // Get lost bids with reasons
      const lostBids = bidderAllBids
        .filter(bid => !bidderWins.some(win => win.item_id === bid.item_id))
        .map(bid => {
          const item = items.find(i => i.id === bid.item_id);
          const collection = collections.find(c => c.id === item?.collection_id);
          const itemResults = auctionResults.filter(result => result.item_id === bid.item_id);
          
          let reason = 'No items allocated';
          let additionalInfo = '';
          
          if (bid.bid_amount / bid.quantity_requested < (item?.starting_bid || 0)) {
            reason = 'Bid below minimum price';
            additionalInfo = `Minimum required: ₹${item?.starting_bid || 0}/unit`;
          } else if (itemResults.length > 0) {
            const lowestWinningPrice = Math.min(...itemResults.map(r => r.original_bid_per_unit || 0));
            reason = 'Outbid by higher bidders';
            additionalInfo = `Lowest winning bid: ₹${lowestWinningPrice}/unit`;
          } else if (item) {
            reason = 'Insufficient inventory for all bidders';
            additionalInfo = `Only ${item.inventory} units available`;
          }
          
          return {
            item_name: item?.name || 'Unknown Item',
            collection_name: collection?.name || 'Unknown Collection',
            bid_amount: bid.bid_amount,
            quantity_requested: bid.quantity_requested,
            price_per_unit: bid.bid_amount / bid.quantity_requested,
            reason,
            additionalInfo,
            starting_bid: item?.starting_bid || 0,
          };
        });
      
      return {
        bidder_name: bidderName,
        items: bidderItems,
        total_spent: totalWinningBids,
        total_refund: totalRefund,
        budget_remaining: auction!.max_budget_per_bidder - totalWinningBids + totalRefund,
        // New fields for complete bid tracking
        total_bids_placed: totalBidsPlaced,
        total_winning_bids: totalWinningBids,
        total_lost_bids: totalLostBids,
        lost_bids: lostBids,
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

  // Update the toggle status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async (newStatus: 'active' | 'closed') => {
      const updateData: any = { 
        status: newStatus,
        updated_at: new Date().toISOString(),
      };
      
      if (newStatus === 'closed') {
        updateData.closed_at = new Date().toISOString();
        
        const { error } = await supabase
          .from('auctions')
          .update(updateData)
          .eq('id', auction!.id);

        if (error) throw error;
        
        // Generate results when closing
        await generateAuctionResults();
      } else {
        const { error } = await supabase
          .from('auctions')
          .update(updateData)
          .eq('id', auction!.id);

        if (error) throw error;
      }

      return newStatus;
    },
    onSuccess: (newStatus) => {
      queryClient.invalidateQueries({ queryKey: ['auction', slug] });
      
      const statusMessages = {
        active: 'Auction has been started.',
        closed: 'Auction has been closed.',
      };
      
      toast({
        title: 'Auction Status Updated',
        description: statusMessages[newStatus],
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

  // Add this helper function near the top of the component
  const generateNewSlug = () => {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${randomStr}`;
  };

  // Updated reset mutation with improved bid deletion handling
  const resetAuctionMutation = useMutation({
    mutationFn: async () => {
      if (!auction?.id) throw new Error('No auction ID found');

      console.log('Starting complete auction reset with enhanced bid deletion...');

      try {
        // 1. Delete auction results first (due to foreign key constraints)
        console.log('Deleting auction results...');
        const { data: deletedResults, error: resultsError } = await supabase
          .from('auction_results')
          .delete()
          .eq('auction_id', auction.id)
          .select();
        if (resultsError) throw resultsError;
        console.log(`Deleted ${deletedResults?.length || 0} auction results`);

        // 2. Delete bidder registrations
        console.log('Deleting bidder registrations...');
        const { data: deletedRegistrations, error: registrationsError } = await supabase
          .from('bidder_registrations')
          .delete()
          .eq('auction_id', auction.id)
          .select();
        if (registrationsError) throw registrationsError;
        console.log(`Deleted ${deletedRegistrations?.length || 0} bidder registrations`);

        // 3. Delete ALL bids for this auction with enhanced approach
        console.log('Deleting all bids with enhanced deletion strategy...');
        const { data: deletedBids, error: bidsError } = await supabase
          .from('bids')
          .delete()
          .eq('auction_id', auction.id)
          .select();
        
        if (bidsError) {
          console.error('Error deleting bids:', bidsError);
          throw new Error(`Failed to delete bids: ${bidsError.message}`);
        }
        
        console.log(`Successfully deleted ${deletedBids?.length || 0} bids`);

        // 4. Final verification - ensure no bids remain
        const { data: remainingBids, error: finalCheckError } = await supabase
          .from('bids')
          .select('id, bidder_name')
          .eq('auction_id', auction.id);
        if (finalCheckError) throw finalCheckError;
        
        if (remainingBids && remainingBids.length > 0) {
          console.error(`Critical: ${remainingBids.length} bids still remain:`, remainingBids);
          throw new Error(`Failed to delete all bids. ${remainingBids.length} bids still remain. Please check database permissions.`);
        }
        console.log('Verified: All bids successfully deleted');

        // 5. Generate new slug for fresh start
        const newSlug = generateNewSlug();
        console.log('Generated new slug:', newSlug);

        // 6. Reset auction to draft state with new slug
        console.log('Resetting auction to draft state...');
        const { error: updateError } = await supabase
          .from('auctions')
          .update({
            status: 'draft',
            slug: newSlug,
            updated_at: new Date().toISOString(),
            closed_at: null // Clear the closed timestamp
          })
          .eq('id', auction.id);
        if (updateError) throw updateError;

        console.log('Complete auction reset successful - all data cleared');
        return newSlug;
      } catch (error) {
        console.error('Error during complete reset:', error);
        throw error;
      }
    },
    onSuccess: (newSlug) => {
      // Invalidate all related queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['auction'] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['auction-results'] });
      queryClient.invalidateQueries({ queryKey: ['all-bidders'] });
      queryClient.invalidateQueries({ queryKey: ['bids'] });
      queryClient.invalidateQueries({ queryKey: ['bidder-status'] });
      queryClient.invalidateQueries({ queryKey: ['bidder-registrations'] });
      
      // Navigate to the new URL
      navigate(`/auction/${newSlug}/manage`, { replace: true });
      
      toast({
        title: 'Complete Reset Successful',
        description: 'All bids, bidders, and auction data have been deleted. A new bidding link has been generated.',
      });
    },
    onError: (error) => {
      console.error('Reset failed:', error);
      toast({
        title: 'Reset Failed',
        description: error.message || 'Failed to reset the auction completely. Please try again.',
        variant: 'destructive',
      });
    }
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
      if (!auction?.id) {
        throw new Error('No auction ID found');
      }
      
      console.log('Starting auction deletion process...');
      
      try {
        // 1. First get all collections and their items
        const { data: collections, error: collectionsError } = await supabase
          .from('collections')
          .select(`
            id,
            items (
              id
            )
          `)
          .eq('auction_id', auction.id);
          
        if (collectionsError) throw collectionsError;
        
        // 2. Delete auction results first (due to foreign key constraints)
        console.log('Deleting auction results...');
        const { error: resultsError } = await supabase
          .from('auction_results')
          .delete()
          .eq('auction_id', auction.id);
          
        if (resultsError) throw resultsError;
        
        // 3. Delete all bids
        console.log('Deleting all bids...');
        const { error: bidsError } = await supabase
          .from('bids')
          .delete()
          .eq('auction_id', auction.id);
          
        if (bidsError) throw bidsError;
        
        // 4. Delete all items from all collections
        if (collections?.length) {
          const itemIds = collections.flatMap(c => c.items?.map(i => i.id) || []);
          if (itemIds.length) {
            console.log(`Deleting ${itemIds.length} items...`);
            const { error: itemsError } = await supabase
              .from('items')
              .delete()
              .in('id', itemIds);
              
            if (itemsError) throw itemsError;
          }
        }
        
        // 5. Delete all collections
        console.log('Deleting collections...');
        const { error: collectionsDeleteError } = await supabase
          .from('collections')
          .delete()
          .eq('auction_id', auction.id);
          
        if (collectionsDeleteError) throw collectionsDeleteError;
        
        // 6. Finally delete the auction itself
        console.log('Deleting auction...');
        const { error: auctionError } = await supabase
          .from('auctions')
          .delete()
          .eq('id', auction.id);
          
        if (auctionError) throw auctionError;
        
        console.log('Auction deletion completed successfully');
      } catch (error) {
        console.error('Error during auction deletion:', error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: 'Auction Deleted',
        description: 'Auction and all associated data have been deleted successfully.',
      });
      navigate('/dashboard');
    },
    onError: (error) => {
      console.error('Auction deletion failed:', error);
      toast({
        title: 'Deletion Failed',
        description: 'Failed to delete the auction. Please try again.',
        variant: 'destructive',
      });
    }
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
      console.log('Starting collection deletion process...');
      
      try {
        // 1. First check if collection exists and get its items
        const { data: items, error: itemsError } = await supabase
          .from('items')
          .select('id')
          .eq('collection_id', collectionId);
        
        if (itemsError) throw itemsError;
        
        // 2. Delete all bids associated with the items in this collection
        if (items?.length) {
          const itemIds = items.map(item => item.id);
          console.log(`Deleting bids for ${itemIds.length} items...`);
          
          const { error: bidsError } = await supabase
            .from('bids')
            .delete()
            .in('item_id', itemIds);
            
          if (bidsError) throw bidsError;
        }
        
        // 3. Delete all auction results for these items
        if (items?.length) {
          console.log('Deleting auction results for items...');
          const { error: resultsError } = await supabase
            .from('auction_results')
            .delete()
            .in('item_id', items.map(item => item.id));
            
          if (resultsError) throw resultsError;
        }
        
        // 4. Delete all items in the collection
        console.log('Deleting items...');
        const { error: itemsDeleteError } = await supabase
          .from('items')
          .delete()
          .eq('collection_id', collectionId);
          
        if (itemsDeleteError) throw itemsDeleteError;
        
        // 5. Finally delete the collection itself
        console.log('Deleting collection...');
        const { error: collectionError } = await supabase
          .from('collections')
          .delete()
          .eq('id', collectionId);

        if (collectionError) throw collectionError;
        
        console.log('Collection deletion completed successfully');
      } catch (error) {
        console.error('Error during collection deletion:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections', auction?.id] });
      queryClient.invalidateQueries({ queryKey: ['items', auction?.id] });
      queryClient.invalidateQueries({ queryKey: ['bids'] });
      queryClient.invalidateQueries({ queryKey: ['auction-results'] });
      toast({
        title: 'Collection Deleted',
        description: 'Collection and all associated data have been deleted successfully.',
      });
    },
    onError: (error) => {
      console.error('Collection deletion failed:', error);
      toast({
        title: 'Deletion Failed',
        description: 'Failed to delete the collection. Please try again.',
        variant: 'destructive',
      });
    }
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
    try {
      const bidUrl = `${window.location.origin}/auction/${slug}/bid`;
      console.log('Copying URL:', bidUrl); // Debug log
      
      // Create a temporary input element
      const tempInput = document.createElement('input');
      tempInput.style.position = 'fixed';
      tempInput.style.opacity = '0';
      tempInput.style.top = '-1000px';
      tempInput.value = bidUrl;
      document.body.appendChild(tempInput);
      
      // Select and copy the text
      tempInput.select();
      document.execCommand('copy');
      
      // Remove the temporary element
      document.body.removeChild(tempInput);
      
      toast({
        title: 'Link Copied!',
        description: 'Bidding link has been copied to clipboard.',
      });
    } catch (error) {
      console.error('Failed to copy link:', error);
      toast({
        title: 'Failed to Copy Link',
        description: 'Please try again or copy the URL manually.',
        variant: 'destructive',
      });
    }
  };

  // Add recalculate results mutation
  const recalculateResultsMutation = useMutation({
    mutationFn: async () => {
      if (!auction?.id) throw new Error('No auction ID found');

      console.log('Recalculating auction results...');
      
      // Call the database function to recalculate results
      const { error } = await supabase.rpc('calculate_average_auction_results', {
        auction_id_param: auction.id
      });

      if (error) throw error;

      return true;
    },
    onSuccess: () => {
      // Invalidate all related queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['auction-results', auction?.id] });
      queryClient.invalidateQueries({ queryKey: ['all-bidders', auction?.id] });
      
      toast({
        title: 'Results Recalculated',
        description: 'Auction results have been regenerated with the latest allocation logic.',
      });
    },
    onError: (error) => {
      console.error('Recalculation failed:', error);
      toast({
        title: 'Recalculation Failed',
        description: 'Failed to recalculate auction results. Please try again.',
        variant: 'destructive',
      });
    }
  });

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
                      onClick={() => toggleStatusMutation.mutate('closed')}
                      variant="destructive"
                      className="flex items-center space-x-2"
                    >
                      <Square className="w-4 h-4" />
                      <span>Close Auction</span>
                    </Button>

                    <Button
                      onClick={copyBidLink}
                      variant="outline"
                      className="flex items-center space-x-2"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Copy Bid Link</span>
                    </Button>
                  </>
                )}
                
                {auction.status === 'closed' && (
                  <>
                    <Button
                      onClick={() => navigate(`/auction/${auction.slug}/monitor`)}
                      className="flex items-center space-x-2"
                    >
                      <BarChart3 className="w-4 h-4" />
                      <span>View Results</span>
                    </Button>

                    <Button
                      onClick={() => recalculateResultsMutation.mutate()}
                      variant="outline"
                      className="flex items-center space-x-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                      disabled={recalculateResultsMutation.isPending}
                    >
                      <Calculator className={`w-4 h-4 ${recalculateResultsMutation.isPending ? 'animate-spin' : ''}`} />
                      <span>Recalculate Results</span>
                    </Button>

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
                            <br />• All bidders will be permanently deleted from the database
                            <br />• All bids will be permanently deleted
                            <br />• All auction results will be cleared
                            <br />• A new bidding link will be generated
                            <br />• Auction status will return to draft
                            <br /><br />
                            This action cannot be undone and will make it like a brand new auction with no history.
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
                  </>
                )}
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

        {/* Enhanced Auction Results - Show only when auction is closed */}
        {auction.status === 'closed' && (
          <>
            {/* Enhanced Bidders Results Card with complete bid information */}
            <Card>
              <CardHeader>
                <CardTitle>Complete Auction Results - Bidding Activity & Outcomes</CardTitle>
                <CardDescription>
                  Comprehensive view showing all bids placed, items won, items lost, and detailed reasons
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
                            {bidder.lost_bids.length > 0 && (
                              <Badge variant="outline" className="text-orange-600 border-orange-200">
                                {bidder.lost_bids.length} Items Lost
                              </Badge>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-blue-600">
                                Total Bids Placed: ₹{bidder.total_bids_placed.toFixed(2)}
                              </p>
                              <p className="text-sm text-gray-600">
                                Winning Bids: ₹{bidder.total_winning_bids.toFixed(2)}
                              </p>
                              {bidder.total_lost_bids > 0 && (
                                <p className="text-sm text-orange-600">
                                  Lost Bids: ₹{bidder.total_lost_bids.toFixed(2)}
                                </p>
                              )}
                              <p className="text-sm text-green-600">Refund: ₹{bidder.total_refund.toFixed(2)}</p>
                              <div className="border-t border-gray-200 pt-1 mt-1">
                                <p className="text-sm font-medium">Budget Remaining: ₹{bidder.budget_remaining.toFixed(2)}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Winning Items */}
                        {bidder.items.length > 0 && (
                          <div className="mb-4">
                            <h5 className="font-medium text-green-800 mb-2 flex items-center">
                              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                              Items Won
                            </h5>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Collection</TableHead>
                                  <TableHead>Item Name</TableHead>
                                  <TableHead>Qty Won</TableHead>
                                  <TableHead>Original Bid/Unit</TableHead>
                                  <TableHead>Average Price/Unit</TableHead>
                                  <TableHead>Total Original Bid</TableHead>
                                  <TableHead>Total After Average</TableHead>
                                  <TableHead>Refund</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {bidder.items.map((item, index) => (
                                  <TableRow key={index}>
                                    <TableCell className="font-medium">{item.collection_name}</TableCell>
                                    <TableCell>{item.item_name}</TableCell>
                                    <TableCell>{item.quantity_won}</TableCell>
                                    <TableCell>₹{item.original_bid_per_unit.toFixed(2)}</TableCell>
                                    <TableCell>₹{item.price_per_unit_paid.toFixed(2)}</TableCell>
                                    <TableCell>₹{(item.original_bid_per_unit * item.quantity_won).toFixed(2)}</TableCell>
                                    <TableCell>₹{item.winning_amount.toFixed(2)}</TableCell>
                                    <TableCell className="text-green-600">₹{item.refund_amount.toFixed(2)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}

                        {/* Lost Items */}
                        {bidder.lost_bids.length > 0 && (
                          <div>
                            <h5 className="font-medium text-orange-800 mb-2 flex items-center">
                              <span className="w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
                              Items Bid On But Not Won
                            </h5>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Collection</TableHead>
                                  <TableHead>Item Name</TableHead>
                                  <TableHead>Your Bid</TableHead>
                                  <TableHead>Qty Requested</TableHead>
                                  <TableHead>Your Price/Unit</TableHead>
                                  <TableHead>Reason Not Won</TableHead>
                                  <TableHead>Additional Info</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {bidder.lost_bids.map((lostBid, index) => (
                                  <TableRow key={index} className="bg-orange-50">
                                    <TableCell className="font-medium">{lostBid.collection_name}</TableCell>
                                    <TableCell>{lostBid.item_name}</TableCell>
                                    <TableCell>₹{lostBid.bid_amount.toFixed(2)}</TableCell>
                                    <TableCell>{lostBid.quantity_requested}</TableCell>
                                    <TableCell>₹{lostBid.price_per_unit.toFixed(2)}</TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className="text-orange-700 border-orange-300">
                                        {lostBid.reason}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm text-gray-600">
                                      {lostBid.additionalInfo}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}

                        {bidder.items.length === 0 && bidder.lost_bids.length === 0 && (
                          <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-lg">
                            <p className="text-sm">This bidder did not place any bids in this auction.</p>
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
