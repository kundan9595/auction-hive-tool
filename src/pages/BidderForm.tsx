
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, AlertCircle, DollarSign, Trophy, Target, Zap, Star, Gift } from 'lucide-react';

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

interface ValidationErrors {
  [itemId: string]: string;
}

export function BidderForm() {
  const { slug } = useParams();
  const [currentStep, setCurrentStep] = useState(0);
  const [bidderName, setBidderName] = useState('');
  const [bidderEmail, setBidderEmail] = useState('');
  const [bids, setBids] = useState<BidData>({});
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

  // Fetch auction details
  const { data: auction, isLoading } = useQuery({
    queryKey: ['auction', slug],
    queryFn: async () => {
      console.log('Fetching auction with slug:', slug);
      const { data, error } = await supabase
        .from('auctions')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'active')
        .single();

      if (error) {
        console.error('Error fetching auction:', error);
        throw error;
      }
      console.log('Auction data:', data);
      return data as Auction;
    },
  });

  // Fetch collections and items
  const { data: collectionsWithItems } = useQuery({
    queryKey: ['auction-items', auction?.id],
    queryFn: async () => {
      if (!auction?.id) return [];

      console.log('Fetching collections for auction:', auction.id);
      const { data: collections, error: collectionsError } = await supabase
        .from('collections')
        .select('*')
        .eq('auction_id', auction.id)
        .order('sort_order');

      if (collectionsError) {
        console.error('Error fetching collections:', collectionsError);
        throw collectionsError;
      }

      console.log('Collections:', collections);

      const { data: items, error: itemsError } = await supabase
        .from('items')
        .select('*')
        .in('collection_id', collections.map(c => c.id))
        .order('sort_order');

      if (itemsError) {
        console.error('Error fetching items:', itemsError);
        throw itemsError;
      }

      console.log('Items:', items);

      return collections.map(collection => ({
        ...collection,
        items: items.filter(item => item.collection_id === collection.id)
      }));
    },
    enabled: !!auction?.id,
  });

  const submitBidsMutation = useMutation({
    mutationFn: async (bidEntries: any[]) => {
      console.log('Submitting bids:', bidEntries);
      
      const { data, error } = await supabase
        .from('bids')
        .upsert(bidEntries, {
          onConflict: 'auction_id,item_id,bidder_name',
        })
        .select();

      if (error) {
        console.error('Error submitting bids:', error);
        throw error;
      }
      
      console.log('Bids submitted successfully:', data);
      return data;
    },
    onSuccess: () => {
      toast({
        title: '🎉 Bids Submitted Successfully!',
        description: 'Your bids have been recorded. Good luck in the auction!',
      });
      setCurrentStep((collectionsWithItems?.length || 0) + 2);
    },
    onError: (error: any) => {
      console.error('Bid submission failed:', error);
      toast({
        title: 'Submission Failed',
        description: error?.message || 'Failed to submit bids. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const totalBidAmount = Object.values(bids).reduce((sum, bid) => sum + (bid || 0), 0);
  const remainingBudget = (auction?.max_budget_per_bidder || 0) - totalBidAmount;
  const isBudgetExceeded = totalBidAmount > (auction?.max_budget_per_bidder || 0);
  const budgetUsedPercentage = ((totalBidAmount / (auction?.max_budget_per_bidder || 1)) * 100);

  const updateBid = (itemId: string, amount: number) => {
    setBids(prev => ({ ...prev, [itemId]: amount }));
    
    // Clear validation error when user updates bid
    if (validationErrors[itemId]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[itemId];
        return newErrors;
      });
    }
  };

  const validateCurrentStep = () => {
    if (currentStep === 0) {
      return bidderName.trim().length > 0;
    }

    if (currentStep > 0 && currentStep <= (collectionsWithItems?.length || 0)) {
      const currentCollection = collectionsWithItems?.[currentStep - 1];
      if (!currentCollection) return true;

      const errors: ValidationErrors = {};
      let hasErrors = false;

      currentCollection.items.forEach((item: Item) => {
        const bidAmount = bids[item.id] || 0;
        if (bidAmount > 0 && bidAmount < item.starting_bid) {
          errors[item.id] = `Bid must be at least ₹${item.starting_bid}`;
          hasErrors = true;
        }
      });

      setValidationErrors(errors);
      return !hasErrors;
    }

    return true;
  };

  const handleNext = () => {
    if (currentStep === 0 && !bidderName.trim()) {
      toast({
        title: 'Name Required',
        description: 'Please enter your name to continue.',
        variant: 'destructive',
      });
      return;
    }

    // Check budget before moving to review step
    if (currentStep === (collectionsWithItems?.length || 0) && isBudgetExceeded) {
      toast({
        title: 'Budget Exceeded',
        description: `Your total bid amount (₹${totalBidAmount.toFixed(2)}) exceeds your budget limit (₹${auction?.max_budget_per_bidder}). Please adjust your bids.`,
        variant: 'destructive',
      });
      return;
    }

    if (!validateCurrentStep()) {
      toast({
        title: 'Invalid Bids',
        description: 'Please fix the bid amounts before continuing.',
        variant: 'destructive',
      });
      return;
    }

    setCurrentStep(currentStep + 1);
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

    if (isBudgetExceeded) {
      toast({
        title: 'Budget Exceeded',
        description: `Your total bid amount (₹${totalBidAmount.toFixed(2)}) exceeds your budget limit (₹${auction.max_budget_per_bidder}). Please go back and adjust your bids.`,
        variant: 'destructive',
      });
      return;
    }

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
      return;
    }

    console.log('Preparing to submit bids:', bidEntries);
    submitBidsMutation.mutate(bidEntries);
  };

  const getBudgetColor = () => {
    if (budgetUsedPercentage > 90) return 'bg-red-500';
    if (budgetUsedPercentage > 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-blue-100 to-indigo-200 flex items-center justify-center">
        <div className="text-center">
          <div className="auction-gradient w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Target className="w-8 h-8 text-white" />
          </div>
          <div className="text-xl font-semibold text-gray-700">Loading auction...</div>
          <div className="text-gray-500">Get ready to bid! 🎯</div>
        </div>
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-blue-100 to-indigo-200 flex items-center justify-center">
        <Card className="max-w-md border-2 border-red-200 bg-red-50">
          <CardContent className="text-center py-12">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-red-800">Auction Not Available</h2>
            <p className="text-red-600">
              This auction is not currently active or doesn't exist.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalSteps = (collectionsWithItems?.length || 0) + 2;
  const isFirstStep = currentStep === 0;
  const isReviewStep = currentStep === (collectionsWithItems?.length || 0) + 1;
  const isSuccessStep = currentStep === (collectionsWithItems?.length || 0) + 2;
  const currentCollection = collectionsWithItems?.[currentStep - 1];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-blue-100 to-indigo-200">
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Vibrant Header */}
        <div className="auction-gradient rounded-2xl p-8 text-white text-center mb-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-white/10 backdrop-blur-sm"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <Trophy className="w-8 h-8" />
              <h1 className="text-3xl font-bold">{auction.name}</h1>
              <Trophy className="w-8 h-8" />
            </div>
            <p className="text-white/90 text-lg mb-4">{auction.description}</p>
            <div className="flex items-center justify-center space-x-4">
              <Badge className="bg-white/20 text-white border-white/30 text-lg px-4 py-2">
                <DollarSign className="w-5 h-5 mr-2" />
                Max Budget: ₹{auction.max_budget_per_bidder}
              </Badge>
            </div>
          </div>
        </div>

        {/* Enhanced Progress Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm text-gray-700 mb-3">
            <div className="flex items-center space-x-2">
              <Star className="w-4 h-4 text-yellow-500" />
              <span className="font-medium">Step {currentStep + 1} of {totalSteps}</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${isBudgetExceeded ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                <DollarSign className="w-4 h-4" />
                <span className="font-bold">
                  ₹{totalBidAmount.toFixed(2)} / ₹{auction.max_budget_per_bidder}
                </span>
              </div>
            </div>
          </div>
          
          <div className="relative">
            <Progress 
              value={((currentStep + 1) / totalSteps) * 100} 
              className="h-3 bg-white/60 budget-progress"
            />
          </div>
          
          {/* Budget Visual Indicator */}
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>Budget Usage</span>
              <span>{budgetUsedPercentage.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${getBudgetColor()}`}
                style={{ width: `${Math.min(budgetUsedPercentage, 100)}%` }}
              ></div>
            </div>
          </div>

          {isBudgetExceeded && (
            <div className="mt-4 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
              <div className="flex items-center space-x-3 text-red-700">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">⚠️ Budget exceeded! Please reduce your bids to continue.</span>
              </div>
            </div>
          )}
        </div>

        {/* Enhanced Content Cards */}
        <div className="gradient-border mb-8">
          <div className="gradient-border-content p-8">
            {/* Step 0: Welcome & Bidder Information */}
            {isFirstStep && (
              <div className="space-y-8">
                <div className="text-center">
                  <div className="w-20 h-20 auction-gradient rounded-full flex items-center justify-center mx-auto mb-6">
                    <Target className="w-10 h-10 text-white" />
                  </div>
                  <CardTitle className="text-2xl mb-3 auction-text-gradient">Welcome to the Auction! 🎯</CardTitle>
                  <CardDescription className="text-lg">
                    Ready to place some exciting bids? Let's get you started!
                  </CardDescription>
                </div>

                <div className="space-y-6 max-w-md mx-auto">
                  <div>
                    <Label htmlFor="bidderName" className="text-lg font-medium text-gray-700">
                      🏷️ Name / Team Name *
                    </Label>
                    <Input
                      id="bidderName"
                      value={bidderName}
                      onChange={(e) => setBidderName(e.target.value)}
                      placeholder="Enter your name or team name"
                      required
                      className="mt-2 text-lg p-4 border-2 border-purple-200 focus:border-purple-400 rounded-xl"
                    />
                  </div>

                  <div>
                    <Label htmlFor="bidderEmail" className="text-lg font-medium text-gray-700">
                      📧 Email (Optional)
                    </Label>
                    <Input
                      id="bidderEmail"
                      type="email"
                      value={bidderEmail}
                      onChange={(e) => setBidderEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="mt-2 text-lg p-4 border-2 border-purple-200 focus:border-purple-400 rounded-xl"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Collection Steps - Enhanced */}
            {!isFirstStep && !isReviewStep && !isSuccessStep && currentCollection && (
              <div className="space-y-8">
                <div className="text-center">
                  <div className="w-16 h-16 auction-gradient rounded-full flex items-center justify-center mx-auto mb-4">
                    <Gift className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle className="text-2xl mb-3 auction-text-gradient">{currentCollection.name}</CardTitle>
                  <CardDescription className="text-lg">
                    {currentCollection.description || 'Place your bids for items in this collection! 🎲'}
                  </CardDescription>
                </div>

                <div className="space-y-6">
                  {currentCollection.items.map((item: Item) => (
                    <div key={item.id} className="gradient-border">
                      <div className="gradient-border-content p-6">
                        <div className="flex justify-between items-start mb-6">
                          <div className="flex-1">
                            <h4 className="text-xl font-bold text-gray-900 mb-2">{item.name}</h4>
                            {item.description && (
                              <p className="text-gray-600 mb-3">{item.description}</p>
                            )}
                            <div className="flex items-center space-x-6 text-sm">
                              <div className="flex items-center space-x-2 bg-blue-50 px-3 py-2 rounded-lg">
                                <Target className="w-4 h-4 text-blue-600" />
                                <span className="font-medium text-blue-700">Starting: ₹{item.starting_bid}</span>
                              </div>
                              <div className="flex items-center space-x-2 bg-green-50 px-3 py-2 rounded-lg">
                                <Zap className="w-4 h-4 text-green-600" />
                                <span className="font-medium text-green-700">Available: {item.inventory}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4">
                          <Label htmlFor={`bid-${item.id}`} className="text-lg font-medium text-gray-700">
                            💰 Your Bid (₹):
                          </Label>
                          <div className="flex-1 max-w-xs">
                            <Input
                              id={`bid-${item.id}`}
                              type="number"
                              step="0.01"
                              min="0"
                              value={bids[item.id] || ''}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value) || 0;
                                updateBid(item.id, value);
                              }}
                              placeholder={`Min: ₹${item.starting_bid}`}
                              className={`text-lg p-3 border-2 rounded-xl ${
                                validationErrors[item.id] 
                                  ? 'border-red-400 bg-red-50' 
                                  : 'border-purple-200 focus:border-purple-400'
                              }`}
                            />
                            {validationErrors[item.id] && (
                              <div className="flex items-center space-x-2 mt-2 text-red-600">
                                <AlertCircle className="w-4 h-4" />
                                <span className="text-sm">{validationErrors[item.id]}</span>
                              </div>
                            )}
                          </div>
                          {bids[item.id] > 0 && (
                            <Badge className="bg-green-100 text-green-800 border-green-300 text-lg px-4 py-2">
                              ✓ ₹{bids[item.id]}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Budget Summary for Current Step */}
                <div className={`p-6 rounded-xl ${isBudgetExceeded ? 'bg-red-50 border-2 border-red-200' : 'bg-blue-50 border-2 border-blue-200'}`}>
                  <div className="flex justify-between items-center text-lg">
                    <span className="font-medium">Remaining Budget:</span>
                    <span className={`font-bold ${remainingBudget < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      ₹{remainingBudget.toFixed(2)}
                    </span>
                  </div>
                  {isBudgetExceeded && (
                    <div className="mt-3 text-red-600 flex items-center space-x-2">
                      <AlertCircle className="w-5 h-5" />
                      <span className="font-medium">Budget exceeded! Reduce your bids to continue.</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Review Step - Enhanced */}
            {isReviewStep && (
              <div className="space-y-8">
                <div className="text-center">
                  <div className="w-20 h-20 auction-gradient rounded-full flex items-center justify-center mx-auto mb-6">
                    <Check className="w-10 h-10 text-white" />
                  </div>
                  <CardTitle className="text-2xl mb-3 auction-text-gradient">Review Your Bids 🔍</CardTitle>
                  <CardDescription className="text-lg">
                    Take a final look before submitting your bids!
                  </CardDescription>
                </div>

                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-xl">
                    <h4 className="font-bold text-lg mb-3 text-gray-800">👤 Bidder Information</h4>
                    <p className="text-gray-700"><strong>Name:</strong> {bidderName}</p>
                    {bidderEmail && <p className="text-gray-700"><strong>Email:</strong> {bidderEmail}</p>}
                  </div>

                  {collectionsWithItems?.map((collection) => {
                    const collectionBids = collection.items.filter((item: Item) => bids[item.id] > 0);
                    if (collectionBids.length === 0) return null;

                    return (
                      <div key={collection.id} className="gradient-border">
                        <div className="gradient-border-content p-6">
                          <h4 className="font-bold text-lg mb-4 auction-text-gradient">{collection.name}</h4>
                          <div className="space-y-3">
                            {collectionBids.map((item: Item) => (
                              <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                <span className="font-medium">{item.name}</span>
                                <Badge className="bg-green-100 text-green-800 border-green-300 text-lg px-3 py-1">
                                  ₹{bids[item.id]}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Final Budget Summary */}
                  <div className={`p-6 rounded-xl ${isBudgetExceeded ? 'bg-red-50 border-2 border-red-200' : 'bg-green-50 border-2 border-green-200'}`}>
                    <div className="space-y-3">
                      <div className="flex justify-between text-xl font-bold">
                        <span>Total Bid Amount:</span>
                        <span className={isBudgetExceeded ? 'text-red-600' : 'text-green-600'}>
                          ₹{totalBidAmount.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Budget Limit:</span>
                        <span>₹{auction.max_budget_per_bidder}</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span>Remaining Budget:</span>
                        <span className={remainingBudget < 0 ? 'text-red-600' : 'text-green-600'}>
                          ₹{remainingBudget.toFixed(2)}
                        </span>
                      </div>
                      {isBudgetExceeded && (
                        <div className="mt-4 text-red-600 flex items-center space-x-2">
                          <AlertCircle className="w-5 h-5" />
                          <span className="font-medium">You must reduce your bids to submit.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <Button
                  onClick={submitBids}
                  disabled={submitBidsMutation.isPending || Object.values(bids).every(bid => bid === 0) || isBudgetExceeded}
                  className="w-full auction-gradient text-white text-xl py-6 rounded-xl shadow-lg hover:shadow-xl"
                  size="lg"
                >
                  {submitBidsMutation.isPending ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Submitting...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <Trophy className="w-6 h-6" />
                      <span>Submit All Bids</span>
                      <Trophy className="w-6 h-6" />
                    </div>
                  )}
                </Button>
              </div>
            )}

            {/* Success Step - Celebration */}
            {isSuccessStep && (
              <div className="text-center space-y-8 celebration-bounce">
                <div className="w-24 h-24 auction-gradient rounded-full flex items-center justify-center mx-auto shadow-2xl">
                  <Trophy className="w-12 h-12 text-white" />
                </div>
                <div>
                  <CardTitle className="text-3xl mb-4 auction-text-gradient">
                    🎉 Congratulations! Bids Submitted! 🎉
                  </CardTitle>
                  <CardDescription className="text-xl">
                    Your bids are in the system! May the best bidder win! 🏆
                  </CardDescription>
                </div>
                <div className="bg-gradient-to-r from-green-50 to-blue-50 p-8 rounded-2xl border-2 border-green-200">
                  <div className="space-y-3">
                    <p className="text-lg font-bold text-green-800">
                      🎯 Total Amount Bid: ₹{totalBidAmount.toFixed(2)}
                    </p>
                    <p className="text-green-700">
                      You'll be notified of the results once the auction closes!
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Navigation */}
        {!isSuccessStep && (
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
              className="border-2 border-purple-200 hover:bg-purple-50 text-lg px-6 py-3"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Previous
            </Button>

            <Button
              onClick={handleNext}
              disabled={isReviewStep}
              className="auction-gradient text-white text-lg px-6 py-3 shadow-lg hover:shadow-xl"
            >
              Next
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
