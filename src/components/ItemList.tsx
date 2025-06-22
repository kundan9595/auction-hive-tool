
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Package, Edit, Trash2, Image } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImageUpload } from './ImageUpload';

interface Item {
  id: string;
  collection_id: string;
  name: string;
  description: string | null;
  starting_bid: number;
  inventory: number;
  sort_order: number;
  image_url: string | null;
}

interface ItemListProps {
  items: Item[];
  auctionStatus: 'draft' | 'active' | 'closed';
}

export function ItemList({ items, auctionStatus }: ItemListProps) {
  const queryClient = useQueryClient();
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editingImageUrl, setEditingImageUrl] = useState<string | null>(null);

  // Edit item mutation
  const editItemMutation = useMutation({
    mutationFn: async (data: { 
      id: string; 
      name: string; 
      description: string; 
      starting_bid: number; 
      inventory: number;
      image_url: string | null;
    }) => {
      const { error } = await supabase
        .from('items')
        .update({
          name: data.name,
          description: data.description || null,
          starting_bid: data.starting_bid,
          inventory: data.inventory,
          image_url: data.image_url,
        })
        .eq('id', data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      setEditingItem(null);
      setEditingImageUrl(null);
      toast({
        title: 'Item Updated',
        description: 'Item has been updated successfully.',
      });
    },
  });

  // Delete item mutation
  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      // Delete any bids for this item first
      await supabase.from('bids').delete().eq('item_id', itemId);
      
      // Delete auction results for this item
      await supabase.from('auction_results').delete().eq('item_id', itemId);
      
      // Delete the item
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast({
        title: 'Item Deleted',
        description: 'Item has been deleted successfully.',
      });
    },
  });

  if (!items.length) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Items Yet</h3>
          <p className="text-gray-600">Add items to this collection to get started.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="w-5 h-5" />
          Items ({items.length}) - Quantity-Based Bidding
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Starting Bid/Unit</TableHead>
                <TableHead>Available Quantity</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-12 h-12 object-cover rounded border"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-100 rounded border flex items-center justify-center">
                        <Image className="w-5 h-5 text-gray-400" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {item.description || <span className="text-gray-400">No description</span>}
                  </TableCell>
                  <TableCell>₹{item.starting_bid}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700">
                      {item.inventory} units
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Dialog 
                        open={editingItem?.id === item.id} 
                        onOpenChange={(open) => {
                          if (open) {
                            setEditingItem(item);
                            setEditingImageUrl(item.image_url);
                          } else {
                            setEditingItem(null);
                            setEditingImageUrl(null);
                          }
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            disabled={auctionStatus === 'closed'}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Edit Item</DialogTitle>
                            <DialogDescription>
                              Update item details for quantity-based bidding.
                            </DialogDescription>
                          </DialogHeader>
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              const formData = new FormData(e.currentTarget);
                              editItemMutation.mutate({
                                id: item.id,
                                name: formData.get('name') as string,
                                description: formData.get('description') as string,
                                starting_bid: parseFloat(formData.get('starting_bid') as string),
                                inventory: parseInt(formData.get('inventory') as string),
                                image_url: editingImageUrl,
                              });
                            }}
                            className="space-y-4"
                          >
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              <div className="space-y-4">
                                <div>
                                  <Label htmlFor="edit-item-name">Item Name</Label>
                                  <Input 
                                    id="edit-item-name" 
                                    name="name" 
                                    defaultValue={item.name}
                                    required 
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="edit-item-description">Description</Label>
                                  <Textarea 
                                    id="edit-item-description" 
                                    name="description" 
                                    defaultValue={item.description || ''}
                                    rows={2}
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label htmlFor="edit-starting-bid">Starting Bid per Unit (₹)</Label>
                                    <Input 
                                      id="edit-starting-bid" 
                                      name="starting_bid" 
                                      type="number"
                                      min="0.01"
                                      step="0.01"
                                      defaultValue={item.starting_bid}
                                      required 
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                      Minimum bid amount per unit
                                    </p>
                                  </div>
                                  <div>
                                    <Label htmlFor="edit-inventory">Available Quantity</Label>
                                    <Input 
                                      id="edit-inventory" 
                                      name="inventory" 
                                      type="number"
                                      min="1"
                                      defaultValue={item.inventory}
                                      required 
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                      Total units available for bidding
                                    </p>
                                  </div>
                                </div>
                              </div>
                              <div>
                                <ImageUpload
                                  currentImageUrl={editingImageUrl}
                                  onImageChange={setEditingImageUrl}
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button type="submit" disabled={editItemMutation.isPending}>
                                {editItemMutation.isPending ? 'Updating...' : 'Update Item'}
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
                            disabled={auctionStatus === 'closed'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Item</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete "{item.name}" and any associated bids. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteItemMutation.mutate(item.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete Item
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
