
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';

interface Auction {
  id: string;
  name: string;
  description: string | null;
  max_budget_per_bidder: number;
  status: string;
}

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
}

interface BidData {
  [itemId: string]: number;
}

export function BidderForm() {
  const { slug } = useParams();
  const [currentStep, setCurrentStep] = useState(0);
  const [bidderName, setBidderName] = useState('');
  const [bidderEmail, setBidderEmail] = useState('');
  const [bids, setBids] = useState<BidData>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch auction details
  const { data: auction, isLoading } = useQuery({
    queryKey: ['auction', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auctions')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'active')
        .single();

      if (error) throw error;
      return data as Auction;
    },
  });

  // Fetch collections and items
  const { data: collectionsWithItems } = useQuery({
    queryKey: ['auction-items', auction?.id],
    queryFn: async () => {
      if (!auction?.id) return [];

      const { data: collections, error: collectionsError } = await supabase
        .from('collections')
        .select('*')
        .eq('auction_id', auction.id)
        .order('sort_order');

      if (collectionsError) throw collectionsError;

      const { data: items, error: itemsError } = await supabase
        .from('items')
        .select('*')
        .in('collection_id', collections.map(c => c.id))
        .order('sort_order');

      if (itemsError) throw itemsError;

      return collections.map(collection => ({
        ...collection,
        items: items.filter(item => item.collection_id === collection.id)
      }));
    },
    enabled: !!auction?.id,
  });

  const totalBidAmount = Object.values(bids).reduce((sum, bid) => sum + (bid || 0), 0);
  const remainingBudget = (auction?.max_budget_per_bidder || 0) - totalBidAmount;

  const updateBid = (itemId: string, amount: number) => {
    const newBids = { ...bids, [itemId]: amount };
    const newTotal = Object.values(newBids).reduce((sum, bid) => sum + (bid || 0), 0);
    
    if (newTotal <= (auction?.max_budget_per_bidder || 0)) {
      setBids(newBids);
    } else {
      toast({
        title: 'Budget Exceeded',
        description: 'This bid would exceed your maximum budget.',
        variant: 'destructive',
      });
    }
  };

  const submitBids = async () => {
    if (!auction || !bidderName.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please provide your name.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const bidEntries = Object.entries(bids)
        .filter(([_, amount]) => amount > 0)
        .map(([itemId, amount]) => ({
          auction_id: auction.id,
          item_id: itemId,
          bidder_name: bidderName.trim(),
          bidder_email: bidderEmail.trim() || null,
          bid_amount: amount,
        }));

      if (bidEntries.length === 0) {
        toast({
          title: 'No Bids Placed',
          description: 'Please place at least one bid.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      const { error } = await supabase
        .from('bids')
        .upsert(bidEntries, {
          onConflict: 'auction_id,item_id,bidder_name',
        });

      if (error) throw error;

      toast({
        title: 'Bids Submitted!',
        description: 'Your bids have been submitted successfully.',
      });

      setCurrentStep((collectionsWithItems?.length || 0) + 2);
    } catch (error) {
      console.error('Error submitting bids:', error);
      toast({
        title: 'Submission Failed',
        description: 'Failed to submit bids. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="h-8 bg-gray-200 rounded w-48 mx-auto mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-32 mx-auto"></div>
        </div>
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="text-center py-12">
            <h2 className="text-xl font-semibold mb-2">Auction Not Available</h2>
            <p className="text-gray-600">
              This auction is not currently active or doesn't exist.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalSteps = (collectionsWithItems?.length || 0) + 2; // +2 for bidder info and review
  const isFirstStep = currentStep === 0;
  const isReviewStep = currentStep === (collectionsWithItems?.length || 0) + 1;
  const isSuccessStep = currentStep === (collectionsWithItems?.length || 0) + 2;
  const currentCollection = collectionsWithItems?.[currentStep - 1]; // Step 1-N are collections

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{auction.name}</h1>
          <p className="text-gray-600 mt-2">{auction.description}</p>
          <Badge className="mt-4 bg-green-100 text-green-800">
            Max Budget: ₹{auction.max_budget_per_bidder}
          </Badge>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>Step {currentStep + 1} of {totalSteps}</span>
            <span>Budget Used: ₹{totalBidAmount} / ₹{auction.max_budget_per_bidder}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${((currentStep + 1) / totalSteps) * 100}%`
              }}
            ></div>
          </div>
        </div>

        {/* Content */}
        <Card>
          <CardContent className="p-8">
            {/* Step 0: Bidder Information */}
            {isFirstStep && (
              <div className="space-y-6">
                <div>
                  <CardTitle className="text-xl mb-2">Welcome to the Auction</CardTitle>
                  <CardDescription>
                    Please provide your information to start bidding.
                  </CardDescription>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="bidderName">Name / Team Name *</Label>
                    <Input
                      id="bidderName"
                      value={bidderName}
                      onChange={(e) => setBidderName(e.target.value)}
                      placeholder="Enter your name or team name"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="bidderEmail">Email (Optional)</Label>
                    <Input
                      id="bidderEmail"
                      type="email"
                      value={bidderEmail}
                      onChange={(e) => setBidderEmail(e.target.value)}
                      placeholder="your@email.com"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Steps 1-N: Collection Steps */}
            {!isFirstStep && !isReviewStep && !isSuccessStep && currentCollection && (
              <div className="space-y-6">
                <div>
                  <CardTitle className="text-xl mb-2">{currentCollection.name}</CardTitle>
                  <CardDescription>
                    {currentCollection.description || 'Place your bids for items in this collection.'}
                  </CardDescription>
                </div>

                <div className="space-y-4">
                  {currentCollection.items.map((item: Item) => (
                    <div key={item.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="font-medium">{item.name}</h4>
                          {item.description && (
                            <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                          )}
                          <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                            <span>Starting Bid: ₹{item.starting_bid}</span>
                            <span>Available: {item.inventory}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <Label htmlFor={`bid-${item.id}`} className="text-sm font-medium">
                          Your Bid (₹):
                        </Label>
                        <Input
                          id={`bid-${item.id}`}
                          type="number"
                          min={item.starting_bid}
                          step="0.01"
                          value={bids[item.id] || ''}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            if (value >= item.starting_bid || value === 0) {
                              updateBid(item.id, value);
                            }
                          }}
                          placeholder={`Min: ₹${item.starting_bid}`}
                          className="w-32"
                        />
                        {bids[item.id] > 0 && (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            ₹{bids[item.id]}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span>Remaining Budget:</span>
                    <span className={remainingBudget < 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
                      ₹{remainingBudget.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Review Step */}
            {isReviewStep && (
              <div className="space-y-6">
                <div>
                  <CardTitle className="text-xl mb-2">Review Your Bids</CardTitle>
                  <CardDescription>
                    Please review your bids before submitting.
                  </CardDescription>
                </div>

                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">Bidder Information</h4>
                    <p><strong>Name:</strong> {bidderName}</p>
                    {bidderEmail && <p><strong>Email:</strong> {bidderEmail}</p>}
                  </div>

                  {collectionsWithItems?.map((collection) => {
                    const collectionBids = collection.items.filter((item: Item) => bids[item.id] > 0);
                    if (collectionBids.length === 0) return null;

                    return (
                      <div key={collection.id} className="border rounded-lg p-4">
                        <h4 className="font-medium mb-3">{collection.name}</h4>
                        <div className="space-y-2">
                          {collectionBids.map((item: Item) => (
                            <div key={item.id} className="flex justify-between items-center">
                              <span className="text-sm">{item.name}</span>
                              <Badge variant="outline">₹{bids[item.id]}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex justify-between text-lg font-medium">
                      <span>Total Bid Amount:</span>
                      <span>₹{totalBidAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600 mt-1">
                      <span>Remaining Budget:</span>
                      <span>₹{remainingBudget.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={submitBids}
                  disabled={isSubmitting || Object.values(bids).every(bid => bid === 0)}
                  className="w-full"
                  size="lg"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit All Bids'}
                  <Check className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}

            {/* Success Step */}
            {isSuccessStep && (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <CardTitle className="text-xl mb-2 text-green-900">Bids Submitted Successfully!</CardTitle>
                  <CardDescription>
                    Thank you for participating. You will be notified of the results once the auction closes.
                  </CardDescription>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-green-700">
                    <strong>Total Amount Bid:</strong> ₹{totalBidAmount.toFixed(2)}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        {!isSuccessStep && (
          <div className="flex justify-between mt-6">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>

            <Button
              onClick={() => {
                if (isFirstStep && !bidderName.trim()) {
                  toast({
                    title: 'Name Required',
                    description: 'Please enter your name to continue.',
                    variant: 'destructive',
                  });
                  return;
                }
                setCurrentStep(currentStep + 1);
              }}
              disabled={isReviewStep}
            >
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
