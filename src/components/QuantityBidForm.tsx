import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Package } from 'lucide-react';

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
  onValidationChange?: (itemId: string, hasError: boolean) => void;
  disabled?: boolean;
  initialBid?: BidData;
}

export function QuantityBidForm({ 
  item, 
  maxBudget, 
  currentBudgetUsed, 
  onSubmitBid,
  onValidationChange,
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

  // Update validation status whenever it changes
  useEffect(() => {
    if (onValidationChange) {
      const hasError = (quantityNum > 0 && (!validQuantity || !validPrice || !canAfford));
      onValidationChange(item.id, hasError);
    }
  }, [quantityNum, validQuantity, validPrice, canAfford, item.id, onValidationChange]);

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
    <div className="gradient-border card-hover">
      <div className="gradient-border-content">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="w-5 h-5 text-purple-600" />
              {item.name}
            </CardTitle>
            <div className="flex gap-2">
              {initialBid && initialBid.totalBid > 0 && (
                <Badge className="bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border-green-200">
                  Bid: ₹{initialBid.totalBid.toLocaleString()}
                </Badge>
              )}
              <Badge variant="outline" className="bg-gradient-to-r from-purple-50 to-blue-50 text-purple-700 border-purple-200">
                {item.inventory} units
              </Badge>
            </div>
          </div>
          {item.description && (
            <p className="text-sm text-gray-600 mt-1">{item.description}</p>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor={`quantity-${item.id}`} className="text-sm font-medium">
                  Quantity
                </Label>
                <div className="relative">
                  <Input
                    id={`quantity-${item.id}`}
                    type="text"
                    value={quantity}
                    onChange={handleQuantityChange}
                    disabled={disabled}
                    placeholder="0"
                    className="pr-12 border-purple-200 focus:border-purple-300 focus:ring-purple-200"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <span className="text-sm text-gray-500">units</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Available: {item.inventory} units
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`price-${item.id}`} className="text-sm font-medium">
                  Price per Unit
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <span className="text-gray-500">₹</span>
                  </div>
                  <Input
                    id={`price-${item.id}`}
                    type="text"
                    value={pricePerUnit}
                    onChange={handlePriceChange}
                    disabled={disabled}
                    placeholder={item.starting_bid.toString()}
                    className="pl-7 border-purple-200 focus:border-purple-300 focus:ring-purple-200"
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Minimum: ₹{item.starting_bid.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Total Bid Summary */}
            {(quantityNum > 0 || pricePerUnitNum > 0) && (
              <div className="mt-4 p-3 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">Total Bid Amount:</span>
                  <span className="text-lg font-semibold text-purple-700">₹{totalBid.toLocaleString()}</span>
                </div>
              </div>
            )}

            {/* Validation Messages */}
            <div className="space-y-2">
              {!canAfford && totalBid > 0 && (
                <Alert variant="destructive" className="bg-red-50 text-red-700 border-red-200">
                  <AlertDescription className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Bid amount (₹{totalBid.toLocaleString()}) exceeds remaining budget (₹{remainingBudget.toLocaleString()})
                  </AlertDescription>
                </Alert>
              )}
              
              {!validQuantity && quantityNum > 0 && (
                <Alert variant="destructive" className="bg-red-50 text-red-700 border-red-200">
                  <AlertDescription className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Quantity must be between 1 and {item.inventory} units
                  </AlertDescription>
                </Alert>
              )}
              
              {!validPrice && pricePerUnitNum > 0 && (
                <Alert variant="destructive" className="bg-red-50 text-red-700 border-red-200">
                  <AlertDescription className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Price per unit must be at least ₹{item.starting_bid.toLocaleString()}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        </CardContent>
      </div>
    </div>
  );
}
