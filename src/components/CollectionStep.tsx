
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package } from 'lucide-react';
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
          </div>
        </CardHeader>
      </Card>

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
