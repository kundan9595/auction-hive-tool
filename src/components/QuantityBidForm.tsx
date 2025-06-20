
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Package, Calculator } from 'lucide-react';

interface Item {
  id: string;
  name: string;
  description: string | null;
  starting_bid: number;
  inventory: number;
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
  onSubmitBid: (itemId: string, quantity: number, pricePerUnit: number, totalBid: number) => void;
  disabled?: boolean;
  initialBid?: BidData;
}

export function QuantityBidForm({ 
  item, 
  maxBudget, 
  currentBudgetUsed, 
  onSubmitBid, 
  disabled = false,
  initialBid
}: QuantityBidFormProps) {
  const [quantity, setQuantity] = useState<string>(initialBid?.quantity.toString() || '');
  const [pricePerUnit, setPricePerUnit] = useState<string>(
    initialBid?.pricePerUnit.toString() || item.starting_bid.toString()
  );
  
  const quantityNum = parseInt(quantity) || 0;
  const pricePerUnitNum = parseFloat(pricePerUnit) || 0;
  const totalBid = quantityNum * pricePerUnitNum;
  
  // Calculate budget excluding current bid if it exists
  const currentBidAmount = initialBid?.totalBid || 0;
  const adjustedBudgetUsed = currentBudgetUsed - currentBidAmount;
  const remainingBudget = maxBudget - adjustedBudgetUsed;
  
  const canAfford = totalBid <= remainingBudget;
  const validQuantity = quantityNum > 0 && quantityNum <= item.inventory;
  const validPrice = pricePerUnitNum >= item.starting_bid;

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d+$/.test(value)) {
      setQuantity(value);
    }
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setPricePerUnit(value);
    }
  };

  // Auto-update bid when values change
  useEffect(() => {
    if (validQuantity && validPrice && canAfford) {
      onSubmitBid(item.id, quantityNum, pricePerUnitNum, totalBid);
    } else if (quantityNum === 0 || pricePerUnitNum === 0) {
      onSubmitBid(item.id, 0, 0, 0);
    }
  }, [quantityNum, pricePerUnitNum, totalBid, canAfford, validQuantity, validPrice]);

  // Update form when initialBid changes
  useEffect(() => {
    if (initialBid) {
      setQuantity(initialBid.quantity.toString());
      setPricePerUnit(initialBid.pricePerUnit.toString());
    }
  }, [initialBid]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="w-5 h-5" />
          {item.name}
          {initialBid && initialBid.totalBid > 0 && (
            <Badge className="bg-green-100 text-green-800">
              Bid: ₹{initialBid.totalBid}
            </Badge>
          )}
        </CardTitle>
        {item.description && (
          <p className="text-sm text-gray-600">{item.description}</p>
        )}
        <div className="flex gap-2">
          <Badge variant="outline">
            Available: {item.inventory} units
          </Badge>
          <Badge variant="outline">
            Min Bid: ₹{item.starting_bid}/unit
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor={`quantity-${item.id}`}>Quantity</Label>
              <Input
                id={`quantity-${item.id}`}
                type="text"
                value={quantity}
                onChange={handleQuantityChange}
                disabled={disabled}
                placeholder="0"
              />
              <p className="text-xs text-gray-500 mt-1">
                Max: {item.inventory} units
              </p>
            </div>
            <div>
              <Label htmlFor={`price-${item.id}`}>Price per Unit (₹)</Label>
              <Input
                id={`price-${item.id}`}
                type="text"
                value={pricePerUnit}
                onChange={handlePriceChange}
                disabled={disabled}
                placeholder={item.starting_bid.toString()}
              />
              <p className="text-xs text-gray-500 mt-1">
                Min: ₹{item.starting_bid}
              </p>
            </div>
          </div>

          {/* Bid Summary */}
          {(quantityNum > 0 || (initialBid && initialBid.totalBid > 0)) && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calculator className="w-4 h-4" />
                <span className="font-medium">Bid Summary</span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Quantity:</span>
                  <span>{quantityNum || 0} units</span>
                </div>
                <div className="flex justify-between">
                  <span>Price per unit:</span>
                  <span>₹{pricePerUnitNum || 0}</span>
                </div>
                <div className="flex justify-between font-medium border-t pt-1">
                  <span>Total bid:</span>
                  <span>₹{totalBid || 0}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Remaining budget:</span>
                  <span>₹{remainingBudget}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Budget after bid:</span>
                  <span className={canAfford ? 'text-green-600' : 'text-red-600'}>
                    ₹{remainingBudget - totalBid}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Validation Messages */}
          {!canAfford && totalBid > 0 && (
            <Alert variant="destructive">
              <AlertDescription>
                Bid amount (₹{totalBid}) exceeds remaining budget (₹{remainingBudget})
              </AlertDescription>
            </Alert>
          )}
          
          {!validQuantity && quantityNum > 0 && (
            <Alert variant="destructive">
              <AlertDescription>
                Quantity must be between 1 and {item.inventory} units
              </AlertDescription>
            </Alert>
          )}
          
          {!validPrice && pricePerUnitNum > 0 && (
            <Alert variant="destructive">
              <AlertDescription>
                Price per unit must be at least ₹{item.starting_bid}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
