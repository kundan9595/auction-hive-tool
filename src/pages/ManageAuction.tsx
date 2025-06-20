
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
import { Plus, Edit, Trash2, Play, Pause, Share2, Copy } from 'lucide-react';
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
  const [showItemForm, setShowItemForm] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);

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
      const { error } = await supabase
        .from('auctions')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', auction!.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auction', slug] });
      toast({
        title: 'Status Updated',
        description: `Auction is now ${auction?.status === 'active' ? 'paused' : 'active'}.`,
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

  // Add item
  const addItemMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const name = formData.get('name') as string;
      const description = formData.get('description') as string;
      const startingBid = parseFloat(formData.get('startingBid') as string);
      const inventory = parseInt(formData.get('inventory') as string);

      const collectionItems = items?.filter(i => i.collection_id === selectedCollection) || [];

      const { error } = await supabase
        .from('items')
        .insert({
          collection_id: selectedCollection!,
          name,
          description: description || null,
          starting_bid: startingBid,
          inventory,
          sort_order: collectionItems.length + 1,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', auction?.id] });
      setShowItemForm(false);
      setSelectedCollection(null);
      toast({
        title: 'Item Added',
        description: 'New item has been created successfully.',
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
                  <Button
                    onClick={() => toggleStatusMutation.mutate('draft')}
                    variant="outline"
                    className="flex items-center space-x-2"
                  >
                    <Pause className="w-4 h-4" />
                    <span>Pause Auction</span>
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

        {/* Collections and Items */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Collections */}
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

              <div className="space-y-2">
                {collections?.map((collection) => (
                  <div
                    key={collection.id}
                    className="p-3 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">{collection.name}</h4>
                        {collection.description && (
                          <p className="text-sm text-gray-600">{collection.description}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {items?.filter(i => i.collection_id === collection.id).length || 0} items
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedCollection(collection.id);
                          setShowItemForm(true);
                        }}
                        disabled={auction.status === 'closed'}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                {!collections?.length && (
                  <p className="text-gray-500 text-center py-4">
                    No collections yet. Add one to get started.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <CardContent>
              {showItemForm && selectedCollection && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    addItemMutation.mutate(new FormData(e.currentTarget));
                  }}
                  className="space-y-4 mb-4 p-4 border rounded-lg bg-gray-50"
                >
                  <div>
                    <Label>Collection: {collections?.find(c => c.id === selectedCollection)?.name}</Label>
                  </div>
                  <div>
                    <Label htmlFor="name">Item Name</Label>
                    <Input id="name" name="name" required />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" name="description" rows={2} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="startingBid">Starting Bid (₹)</Label>
                      <Input
                        id="startingBid"
                        name="startingBid"
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="inventory">Quantity</Label>
                      <Input
                        id="inventory"
                        name="inventory"
                        type="number"
                        min="1"
                        defaultValue="1"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button type="submit" size="sm">Add Item</Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setShowItemForm(false);
                        setSelectedCollection(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}

              <div className="space-y-2">
                {collections?.map((collection) => {
                  const collectionItems = items?.filter(i => i.collection_id === collection.id) || [];
                  
                  if (collectionItems.length === 0) return null;
                  
                  return (
                    <div key={collection.id}>
                      <h4 className="font-medium text-sm text-gray-700 mb-2">{collection.name}</h4>
                      {collectionItems.map((item) => (
                        <div
                          key={item.id}
                          className="p-3 border rounded-lg ml-4 mb-2"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h5 className="font-medium">{item.name}</h5>
                              {item.description && (
                                <p className="text-sm text-gray-600">{item.description}</p>
                              )}
                              <div className="flex space-x-4 text-xs text-gray-500 mt-1">
                                <span>Starting: ₹{item.starting_bid}</span>
                                <span>Qty: {item.inventory}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
                
                {!items?.length && (
                  <p className="text-gray-500 text-center py-4">
                    No items yet. Add collections first, then add items.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
