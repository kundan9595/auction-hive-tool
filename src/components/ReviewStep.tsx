import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Edit, Trash2, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BidData {
  itemId: string;
  quantity: number;
  pricePerUnit: number;
  totalBid: number;
}

interface Item {
  id: string;
  collection_id: string;
  name: string;
  description: string | null;
  starting_bid: number;
  inventory: number;
}

interface Collection {
  id: string;
  name: string;
  description: string | null;
}

interface ReviewStepProps {
  bids: Record<string, BidData>;
  items: Item[];
  collections: Collection[];
  maxBudget: number;
  onEditBid: (itemId: string) => void;
  onRemoveBid: (itemId: string) => void;
  isSubmitting: boolean;
}

export function ReviewStep({ 
  bids, 
  items, 
  collections, 
  maxBudget, 
  onEditBid, 
  onRemoveBid,
  isSubmitting 
}: ReviewStepProps) {
  const bidArray = Object.values(bids);
  const groupedBids = collections.map(collection => {
    const collectionItems = items.filter(item => item.collection_id === collection.id);
    const collectionBids = collectionItems
      .map(item => ({ item, bid: bids[item.id] }))
      .filter(({ bid }) => bid);

    return {
      collection,
      bids: collectionBids
    };
  }).filter(group => group.bids.length > 0);

  if (bidArray.length === 0) {
    return (
      <div className="gradient-border">
        <div className="gradient-border-content">
          <CardContent className="text-center py-12">
            <Package className="w-16 h-16 text-purple-200 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Bids Yet</h3>
            <p className="text-gray-600">Go back to previous steps to place your bids.</p>
          </CardContent>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bids by Collection */}
      {groupedBids.map(({ collection, bids: collectionBids }) => (
        <div key={collection.id} className="gradient-border card-hover">
          <div className="gradient-border-content">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-purple-600" />
                  {collection.name}
                </CardTitle>
                <Badge className="bg-gradient-to-r from-purple-50 to-blue-50 text-purple-700 border-purple-200">
                  {collectionBids.length} {collectionBids.length === 1 ? 'bid' : 'bids'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {collectionBids.map(({ item, bid }) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-lg bg-gradient-to-r from-gray-50 to-purple-50 border border-purple-100"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{item.name}</h4>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-sm text-gray-600">
                            {bid.quantity} units × ₹{bid.pricePerUnit.toLocaleString()}
                          </span>
                          <span className="text-sm font-medium text-purple-700">
                            = ₹{bid.totalBid.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEditBid(item.id)}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Edit className="w-4 h-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRemoveBid(item.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="sr-only">Remove</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </div>
        </div>
      ))}
    </div>
  );
}
