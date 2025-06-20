
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, Calculator } from 'lucide-react';
import { QuantityBidForm } from './QuantityBidForm';

interface Collection {
  id: string;
  name: string;
  description: string | null;
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

interface BidData {
  itemId: string;
  quantity: number;
  pricePerUnit: number;
  totalBid: number;
}

interface CollectionStepProps {
  collection: Collection;
  items: Item[];
  maxBudget: number;
  currentBudgetUsed: number;
  bids: Record<string, BidData>;
  onBidUpdate: (itemId: string, bidData: BidData | null) => void;
}

export function CollectionStep({ 
  collection, 
  items, 
  maxBudget, 
  currentBudgetUsed, 
  bids,
  onBidUpdate 
}: CollectionStepProps) {
  const handleBidSubmit = (itemId: string, quantity: number, pricePerUnit: number, totalBid: number) => {
    onBidUpdate(itemId, { itemId, quantity, pricePerUnit, totalBid });
  };

  // Calculate step-wise summary
  const stepBids = items
    .map(item => bids[item.id])
    .filter(bid => bid && bid.totalBid > 0);
  
  const stepTotal = stepBids.reduce((sum, bid) => sum + bid.totalBid, 0);
  const remainingBudget = maxBudget - currentBudgetUsed;

  return (
    <div className="space-y-6">
      {/* Collection Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            {collection.name}
          </CardTitle>
          {collection.description && (
            <CardDescription>{collection.description}</CardDescription>
          )}
          <div className="flex gap-2">
            <Badge variant="outline">
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </Badge>
            {stepBids.length > 0 && (
              <Badge className="bg-blue-100 text-blue-800">
                {stepBids.length} {stepBids.length === 1 ? 'bid' : 'bids'} placed
              </Badge>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Step Summary */}
      {stepBids.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              Step Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">Bids in this step</p>
                <p className="text-xl font-bold">{stepBids.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Step total</p>
                <p className="text-xl font-bold text-blue-600">₹{stepTotal}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Remaining budget</p>
                <p className={`text-xl font-bold ${remainingBudget >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ₹{remainingBudget}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Items */}
      <div className="grid gap-6">
        {items.map((item) => (
          <QuantityBidForm
            key={item.id}
            item={item}
            maxBudget={maxBudget}
            currentBudgetUsed={currentBudgetUsed}
            onSubmitBid={handleBidSubmit}
            initialBid={bids[item.id]}
          />
        ))}
      </div>
    </div>
  );
}
