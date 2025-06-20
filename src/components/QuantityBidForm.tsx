
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

interface QuantityBidFormProps {
  item: Item;
  maxBudget: number;
  currentBudgetUsed: number;
  onSubmitBid: (itemId: string, quantity: number, pricePerUnit: number, totalBid: number) => void;
  disabled?: boolean;
}

export function QuantityBidForm({ 
  item, 
  maxBudget, 
  currentBudgetUsed, 
  onSubmitBid, 
  disabled = false 
}: QuantityBidFormProps) {
  const [quantity, setQuantity] = useState(1);
  const [pricePerUnit, setPricePerUnit] = useState(item.starting_bid);
  
  const totalBid = quantity * pricePerUnit;
  const remainingBudget = maxBudget - currentBudgetUsed;
  const canAfford = totalBid <= remainingBudget;
  const validQuantity = quantity > 0 && quantity <= item.inventory;
  const validPrice = pricePerUnit >= item.starting_bid;
  const canSubmit = canAfford && validQuantity && validPrice && !disabled;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canSubmit) {
      onSubmitBid(item.id, quantity, pricePerUnit, totalBid);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="w-5 h-5" />
          {item.name}
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor={`quantity-${item.id}`}>Quantity</Label>
              <Input
                id={`quantity-${item.id}`}
                type="number"
                min="1"
                max={item.inventory}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                disabled={disabled}
              />
              <p className="text-xs text-gray-500 mt-1">
                Max: {item.inventory} units
              </p>
            </div>
            <div>
              <Label htmlFor={`price-${item.id}`}>Price per Unit (₹)</Label>
              <Input
                id={`price-${item.id}`}
                type="number"
                min={item.starting_bid}
                step="0.01"
                value={pricePerUnit}
                onChange={(e) => setPricePerUnit(parseFloat(e.target.value) || item.starting_bid)}
                disabled={disabled}
              />
              <p className="text-xs text-gray-500 mt-1">
                Min: ₹{item.starting_bid}
              </p>
            </div>
          </div>

          {/* Bid Summary */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="w-4 h-4" />
              <span className="font-medium">Bid Summary</span>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Quantity:</span>
                <span>{quantity} units</span>
              </div>
              <div className="flex justify-between">
                <span>Price per unit:</span>
                <span>₹{pricePerUnit}</span>
              </div>
              <div className="flex justify-between font-medium border-t pt-1">
                <span>Total bid:</span>
                <span>₹{totalBid}</span>
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

          {/* Validation Messages */}
          {!canAfford && (
            <Alert variant="destructive">
              <AlertDescription>
                Bid amount (₹{totalBid}) exceeds remaining budget (₹{remainingBudget})
              </AlertDescription>
            </Alert>
          )}
          
          {!validQuantity && (
            <Alert variant="destructive">
              <AlertDescription>
                Quantity must be between 1 and {item.inventory} units
              </AlertDescription>
            </Alert>
          )}
          
          {!validPrice && (
            <Alert variant="destructive">
              <AlertDescription>
                Price per unit must be at least ₹{item.starting_bid}
              </AlertDescription>
            </Alert>
          )}

          <Button 
            type="submit" 
            className="w-full" 
            disabled={!canSubmit}
          >
            {disabled ? 'Bidding Closed' : `Place Bid: ₹${totalBid}`}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
