
import { useState } from 'react';
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
import { Plus, Upload, Download, ArrowLeft, FileText } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { CSVUploader } from '@/components/CSVUploader';
import { ItemList } from '@/components/ItemList';

interface Collection {
  id: string;
  name: string;
  description: string | null;
  auction_id: string;
}

interface Auction {
  id: string;
  name: string;
  slug: string;
  status: 'draft' | 'active' | 'closed';
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

export function CollectionDetail() {
  const { slug, collectionId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showItemForm, setShowItemForm] = useState(false);

  // Fetch auction details
  const { data: auction } = useQuery({
    queryKey: ['auction', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auctions')
        .select('id, name, slug, status')
        .eq('slug', slug)
        .single();

      if (error) throw error;
      return data as Auction;
    },
  });

  // Fetch collection details
  const { data: collection, isLoading: collectionLoading } = useQuery({
    queryKey: ['collection', collectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collections')
        .select('*')
        .eq('id', collectionId)
        .single();

      if (error) throw error;
      return data as Collection;
    },
  });

  // Fetch items in this collection
  const { data: items } = useQuery({
    queryKey: ['items', collectionId],
    queryFn: async () => {
      if (!collectionId) return [];
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('collection_id', collectionId)
        .order('sort_order');

      if (error) throw error;
      return data as Item[];
    },
    enabled: !!collectionId,
  });

  // Add item mutation
  const addItemMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const name = formData.get('name') as string;
      const description = formData.get('description') as string;
      const startingBid = parseFloat(formData.get('startingBid') as string);
      const inventory = parseInt(formData.get('inventory') as string);

      const { error } = await supabase
        .from('items')
        .insert({
          collection_id: collectionId!,
          name,
          description: description || null,
          starting_bid: startingBid,
          inventory,
          sort_order: (items?.length || 0) + 1,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', collectionId] });
      setShowItemForm(false);
      toast({
        title: 'Item Added',
        description: 'New item has been created successfully.',
      });
    },
  });

  const downloadSampleCSV = () => {
    const sampleData = [
      ['name', 'description', 'starting_bid', 'inventory'],
      ['Vintage Camera', 'Classic 35mm camera from 1970s', '150.00', '1'],
      ['Art Print Set', 'Set of 3 botanical prints', '75.50', '5'],
      ['Coffee Mug', 'Handmade ceramic mug', '25.00', '10']
    ];

    const csvContent = sampleData.map(row => 
      row.map(field => `"${field}"`).join(',')
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample-items.csv';
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: 'Sample Downloaded',
      description: 'Sample CSV template has been downloaded.',
    });
  };

  if (collectionLoading) {
    return (
      <Layout>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="space-y-4">
            <div className="h-48 bg-gray-200 rounded"></div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!collection || !auction) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold">Collection not found</h2>
          <Button onClick={() => navigate(`/auction/${slug}/manage`)} className="mt-4">
            Back to Auction
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Breadcrumb Navigation */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href={`/auction/${slug}/manage`}>
                {auction.name}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbPage>{collection.name}</BreadcrumbPage>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Collection Header */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/auction/${slug}/manage`)}
                    className="mr-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  {collection.name}
                </CardTitle>
                <CardDescription className="mt-2">
                  {collection.description || 'No description provided'}
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
                <span className="text-gray-600">Items:</span>
                <span className="font-medium ml-1">{items?.length || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Item Management */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Add Individual Item */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Add Item</CardTitle>
                <Button
                  size="sm"
                  onClick={() => setShowItemForm(!showItemForm)}
                  disabled={auction.status === 'closed'}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Single Item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {showItemForm && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    addItemMutation.mutate(new FormData(e.currentTarget));
                  }}
                  className="space-y-4"
                >
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
                      onClick={() => setShowItemForm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          {/* CSV Bulk Upload */}
          <Card>
            <CardHeader>
              <CardTitle>Bulk Upload Items</CardTitle>
              <CardDescription>
                Upload multiple items at once using a CSV file
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button
                  variant="outline"
                  onClick={downloadSampleCSV}
                  className="w-full"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Sample CSV
                </Button>
                
                <CSVUploader
                  collectionId={collectionId!}
                  auctionStatus={auction.status}
                  onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['items', collectionId] });
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Items List */}
        <ItemList items={items || []} auctionStatus={auction.status} />
      </div>
    </Layout>
  );
}
