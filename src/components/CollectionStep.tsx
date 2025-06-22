
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package } from 'lucide-react';
import { QuantityBidForm } from './QuantityBidForm';
import { useState, useEffect } from 'react';

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
  image_url: string | null;
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
  onValidationChange?: (hasErrors: boolean) => void;
}

export function CollectionStep({ 
  collection, 
  items, 
  maxBudget, 
  currentBudgetUsed, 
  bids,
  onBidUpdate,
  onValidationChange
}: CollectionStepProps) {
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());

  const handleValidationChange = (itemId: string, hasError: boolean) => {
    setValidationErrors(prev => {
      const newErrors = new Set(prev);
      if (hasError) {
        newErrors.add(itemId);
      } else {
        newErrors.delete(itemId);
      }
      return newErrors;
    });
  };

  // Notify parent of validation status changes
  useEffect(() => {
    onValidationChange?.(validationErrors.size > 0);
  }, [validationErrors, onValidationChange]);

  // Calculate step-wise summary
  const stepBids = items
    .map(item => bids[item.id])
    .filter(bid => bid && bid.totalBid > 0);

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
            {validationErrors.size > 0 && (
              <Badge variant="destructive">
                {validationErrors.size} {validationErrors.size === 1 ? 'error' : 'errors'}
              </Badge>
            )}
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
            currentBid={bids[item.id]}
            onBidUpdate={onBidUpdate}
            onValidationChange={(hasErrors) => handleValidationChange(item.id, hasErrors)}
          />
        ))}
      </div>
    </div>
  );
}
