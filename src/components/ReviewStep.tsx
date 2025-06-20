
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, Edit, Trash2, Package } from 'lucide-react';

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
  onSubmitAllBids: () => void;
  isSubmitting: boolean;
}

export function ReviewStep({ 
  bids, 
  items, 
  collections, 
  maxBudget, 
  onEditBid, 
  onRemoveBid, 
  onSubmitAllBids,
  isSubmitting 
}: ReviewStepProps) {
  const bidArray = Object.values(bids);
  const totalBidAmount = bidArray.reduce((sum, bid) => sum + bid.totalBid, 0);
  const remainingBudget = maxBudget - totalBidAmount;

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
      <Card>
        <CardContent className="text-center py-12">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Bids Yet</h3>
          <p className="text-gray-600">Go back to previous steps to place your bids.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Budget Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Bid Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Total Bids</p>
              <p className="text-2xl font-bold">{bidArray.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Amount</p>
              <p className="text-2xl font-bold text-blue-600">₹{totalBidAmount}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Remaining Budget</p>
              <p className={`text-2xl font-bold ${remainingBudget >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ₹{remainingBudget}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bids by Collection */}
      {groupedBids.map(({ collection, bids: collectionBids }) => (
        <Card key={collection.id}>
          <CardHeader>
            <CardTitle className="text-lg">{collection.name}</CardTitle>
            <Badge variant="outline" className="w-fit">
              {collectionBids.length} {collectionBids.length === 1 ? 'bid' : 'bids'}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {collectionBids.map(({ item, bid }) => (
                <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium">{item.name}</h4>
                    <p className="text-sm text-gray-600">
                      {bid.quantity} units × ₹{bid.pricePerUnit} = ₹{bid.totalBid}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditBid(item.id)}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveBid(item.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      <Separator />

      {/* Submit Button */}
      <div className="flex justify-center">
        <Button
          onClick={onSubmitAllBids}
          disabled={isSubmitting || remainingBudget < 0}
          size="lg"
          className="px-8"
        >
          {isSubmitting ? 'Submitting...' : `Submit All Bids (₹${totalBidAmount})`}
        </Button>
      </div>
    </div>
  );
}
