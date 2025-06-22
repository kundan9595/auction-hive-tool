
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Image, AlertCircle } from 'lucide-react';

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

interface QuantityBidFormProps {
  item: Item;
  maxBudget: number;
  currentBudgetUsed: number;
  currentBid?: BidData;
  onBidUpdate: (itemId: string, bidData: BidData | null) => void;
  onValidationChange?: (hasErrors: boolean) => void;
}

export function QuantityBidForm({
  item,
  maxBudget,
  currentBudgetUsed,
  currentBid,
  onBidUpdate,
  onValidationChange
}: QuantityBidFormProps) {
  const [quantity, setQuantity] = useState(currentBid?.quantity || 0);
  const [pricePerUnit, setPricePerUnit] = useState(currentBid?.pricePerUnit || item.starting_bid);
  const [error, setError] = useState('');

  const totalBid = quantity * pricePerUnit;
  const remainingBudget = maxBudget - currentBudgetUsed + (currentBid?.totalBid || 0);
  const isOverBudget = totalBid > remainingBudget;
  const isPriceValid = pricePerUnit >= item.starting_bid;
  const isQuantityValid = quantity >= 0 && quantity <= item.inventory;

  const hasValidationErrors = isOverBudget || !isPriceValid || !isQuantityValid;

  useEffect(() => {
    onValidationChange?.(hasValidationErrors);
  }, [hasValidationErrors, onValidationChange]);

  useEffect(() => {
    if (quantity > 0 && isPriceValid && isQuantityValid && !isOverBudget) {
      onBidUpdate(item.id, {
        itemId: item.id,
        quantity,
        pricePerUnit,
        totalBid
      });
      setError('');
    } else if (quantity === 0) {
      onBidUpdate(item.id, null);
      setError('');
    } else {
      if (isOverBudget) {
        setError(`This bid exceeds your remaining budget of ₹${remainingBudget.toLocaleString()}`);
      } else if (!isPriceValid) {
        setError(`Price per unit must be at least ₹${item.starting_bid} (minimum bid)`);
      } else if (!isQuantityValid) {
        setError(`Quantity must be between 0 and ${item.inventory}`);
      }
    }
  }, [quantity, pricePerUnit, item.id, isPriceValid, isQuantityValid, isOverBudget, onBidUpdate, totalBid, remainingBudget, item.starting_bid, item.inventory]);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex gap-4">
          {/* Item Image */}
          <div className="flex-shrink-0">
            {item.image_url ? (
              <img
                src={item.image_url}
                alt={item.name}
                className="w-20 h-20 object-cover rounded-lg border shadow-sm"
              />
            ) : (
              <div className="w-20 h-20 bg-gray-100 rounded-lg border flex items-center justify-center">
                <Image className="w-8 h-8 text-gray-400" />
              </div>
            )}
          </div>
          
          {/* Item Details */}
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg leading-tight mb-1">{item.name}</CardTitle>
            {item.description && (
              <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">
                {item.description}
              </p>
            )}
            <div className="flex gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                Min: ₹{item.starting_bid}/unit
              </Badge>
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                {item.inventory} available
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor={`quantity-${item.id}`} className="text-sm font-medium">
              Quantity
            </Label>
            <Input
              id={`quantity-${item.id}`}
              type="number"
              min="0"
              max={item.inventory}
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
              className="mt-1"
              placeholder="0"
            />
            <p className="text-xs text-gray-500 mt-1">
              Max: {item.inventory} units
            </p>
          </div>
          
          <div>
            <Label htmlFor={`price-${item.id}`} className="text-sm font-medium">
              Price per Unit (₹)
            </Label>
            <Input
              id={`price-${item.id}`}
              type="number"
              min={item.starting_bid}
              step="0.01"
              value={pricePerUnit}
              onChange={(e) => setPricePerUnit(parseFloat(e.target.value) || 0)}
              className="mt-1"
              placeholder={item.starting_bid.toString()}
            />
            <p className="text-xs text-gray-500 mt-1">
              Min: ₹{item.starting_bid}
            </p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">{error}</AlertDescription>
          </Alert>
        )}

        {quantity > 0 && !hasValidationErrors && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-green-800">Total Bid</span>
              <span className="text-lg font-bold text-green-900">
                ₹{totalBid.toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-green-700 mt-1">
              {quantity} unit{quantity !== 1 ? 's' : ''} × ₹{pricePerUnit} each
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
