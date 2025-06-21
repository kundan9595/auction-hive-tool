import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { User, Wallet, RotateCcw, RefreshCw, ChevronLeft, ChevronRight, Send, AlertCircle, AlertTriangle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Stepper } from '@/components/Stepper';
import { CollectionStep } from '@/components/CollectionStep';
import { ReviewStep } from '@/components/ReviewStep';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface Auction {
  id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'active' | 'closed' | 'paused';
  max_budget_per_bidder: number;
}

interface Collection {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
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

export default function BidderForm() {
  const { slug } = useParams();
  const queryClient = useQueryClient();
  
  // Registration state
  const [bidderName, setBidderName] = useState('');
  const [bidderEmail, setBidderEmail] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [registrationError, setRegistrationError] = useState('');
  
  // Stepper state
  const [currentStep, setCurrentStep] = useState(0);
  const [bids, setBids] = useState<Record<string, BidData>>({});
  const [hasValidationErrors, setHasValidationErrors] = useState(false);

  // Load saved data from localStorage
  useEffect(() => {
    if (slug) {
      const savedData = localStorage.getItem(`auction-${slug}-bidder-data`);
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          setBidderName(parsed.bidderName || '');
          setBidderEmail(parsed.bidderEmail || '');
          setIsRegistered(parsed.isRegistered || false);
          setBids(parsed.bids || {});
          setCurrentStep(parsed.currentStep || 0);
        } catch (error) {
          console.error('Error loading saved data:', error);
        }
      }
    }
  }, [slug]);

  // Save data to localStorage
  useEffect(() => {
    if (slug) {
      const dataToSave = {
        bidderName,
        bidderEmail,
        isRegistered,
        bids,
        currentStep
      };
      localStorage.setItem(`auction-${slug}-bidder-data`, JSON.stringify(dataToSave));
    }
  }, [slug, bidderName, bidderEmail, isRegistered, bids, currentStep]);

  // Fetch auction details
  const { data: auction, isLoading: auctionLoading } = useQuery({
    queryKey: ['auction-public', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auctions')
        .select('*')
        .eq('slug', slug)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned - auction not found
          return null;
        }
        throw error;
      }
      return data as Auction;
    },
  });

  // Fetch collections
  const { data: collections } = useQuery({
    queryKey: ['collections-public', auction?.id],
    queryFn: async () => {
      if (!auction?.id) return [];
      const { data, error } = await supabase
        .from('collections')
        .select('*')
        .eq('auction_id', auction.id)
        .order('sort_order');

      if (error) throw error;
      return data as Collection[];
    },
    enabled: !!auction?.id,
  });

  // Fetch items
  const { data: items } = useQuery({
    queryKey: ['items-public', auction?.id],
    queryFn: async () => {
      if (!auction?.id || !collections) return [];
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .in('collection_id', collections.map(c => c.id))
        .order('sort_order');

      if (error) throw error;
      return data as Item[];
    },
    enabled: !!auction?.id && !!collections,
  });

  const currentBudgetUsed = Object.values(bids).reduce((sum, bid) => sum + bid.totalBid, 0);
  const isBudgetExceeded = !!auction && currentBudgetUsed > auction.max_budget_per_bidder;

  // Subscribe to auction status changes
  useEffect(() => {
    if (!auction?.id) return;

    const channel = supabase
      .channel(`auction-${auction.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'auctions',
          filter: `id=eq.${auction.id}`,
        },
        (payload) => {
          const updatedAuction = payload.new as Auction;
          queryClient.setQueryData(['auction-public', slug], updatedAuction);
          
          // Show toast when auction status changes
          if (updatedAuction.status !== auction.status) {
            switch (updatedAuction.status) {
              case 'paused':
                toast({
                  title: "Auction Paused",
                  description: "The auction has been temporarily paused. Please wait for it to resume.",
                  variant: "destructive",
                });
                break;
              case 'closed':
                toast({
                  title: "Auction Closed",
                  description: "This auction has ended and is no longer accepting bids.",
                  variant: "destructive",
                });
                break;
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [auction?.id, slug, queryClient]);

  // Register bidder mutation
  const registerBidderMutation = useMutation({
    mutationFn: async () => {
      if (!auction?.id) throw new Error('Auction not found');
      
      const { error } = await supabase
        .from('bidder_registrations')
        .insert({
          auction_id: auction.id,
          bidder_name: bidderName,
          bidder_email: bidderEmail,
          status: 'bidding'
        });

      if (error) {
        console.error('Registration error:', error);
        if (error.code === '23505') { // Unique constraint violation
          if (error.message.includes('unique_bidder_name_per_auction')) {
            throw new Error('This name is already taken for this auction. Please choose a different name.');
          } else if (error.message.includes('unique_bidder_email_per_auction')) {
            throw new Error('This email is already registered for this auction. Please use a different email.');
          }
        }
        throw error;
      }
    },
    onSuccess: () => {
      setIsRegistered(true);
      setCurrentStep(1);
      setRegistrationError('');
      toast({
        title: 'Registration Successful',
        description: 'You can now proceed to place bids.',
      });
    },
    onError: (error) => {
      setRegistrationError(error.message);
      toast({
        title: "Registration Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Submit mutation with status check
  const submitAllBidsMutation = useMutation({
    mutationFn: async () => {
      // Check auction status before submitting
      const { data: currentAuction } = await supabase
        .from('auctions')
        .select('status')
        .eq('id', auction.id)
        .single();

      if (!currentAuction) {
        throw new Error('Auction not found');
      }

      if (currentAuction.status === 'closed') {
        setIsSubmitted(true); // This will show our custom closed message
        throw new Error('AUCTION_CLOSED');
      }

      if (currentAuction.status !== 'active') {
        throw new Error(`Cannot submit bids: Auction is ${currentAuction.status}`);
      }

      const bidArray = Object.values(bids).filter(bid => bid.totalBid > 0);
      
      if (bidArray.length === 0) {
        throw new Error('No bids to submit');
      }

      console.log('Submitting bids for auction:', auction!.id, 'bidder:', bidderName);
      console.log('Bid data:', bidArray);

      // Use upsert instead of delete + insert to handle the unique constraint
      const bidInserts = bidArray.map(bid => ({
        auction_id: auction!.id,
        item_id: bid.itemId,
        bidder_name: bidderName,
        bidder_email: bidderEmail,
        bid_amount: bid.totalBid,
        quantity_requested: bid.quantity,
      }));

      console.log('Upserting bids:', bidInserts);

      // Upsert bids - this will insert new ones or update existing ones
      const { error } = await supabase
        .from('bids')
        .upsert(bidInserts, {
          onConflict: 'auction_id,item_id,bidder_name', // Handle conflicts on the unique constraint
          ignoreDuplicates: false // We want to update existing bids, not ignore them
        });
        
      if (error) {
        console.error('Error upserting bids:', error);
        throw error;
      }

      // Update bidder status to complete
      await supabase
        .from('bidder_registrations')
        .update({ 
          status: 'complete',
          completed_at: new Date().toISOString()
        })
        .eq('auction_id', auction!.id)
        .eq('bidder_name', bidderName);

      console.log('Bids submitted successfully');
    },
    onSuccess: () => {
      if (slug) {
        localStorage.removeItem(`auction-${slug}-bidder-data`);
      }
      toast({
        title: 'Bids Submitted Successfully!',
        description: `${Object.values(bids).filter(b => b.totalBid > 0).length} bids have been submitted.`,
      });
      setIsSubmitted(true);
    },
    onError: (error) => {
      if (error.message === 'AUCTION_CLOSED') {
        // Don't show error toast for closed auction
        return;
      }
      toast({
        title: "Failed to submit bids",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Reset functions
  const handleResetBids = () => {
    if (Object.keys(bids).length === 0) {
      toast({
        title: 'No Bids to Reset',
        description: 'You haven\'t placed any bids yet.',
        variant: 'default',
      });
      return;
    }

    setBids({});
    toast({
      title: 'Bids Reset',
      description: 'All your bids have been cleared. You can start placing new bids.',
    });
  };

  const handleRestartSession = () => {
    // Clear all data
    setBidderName('');
    setBidderEmail('');
    setIsRegistered(false);
    setBids({});
    setCurrentStep(0);
    setRegistrationError('');
    
    // Clear localStorage
    if (slug) {
      localStorage.removeItem(`auction-${slug}-bidder-data`);
    }
    
    toast({
      title: 'Session Restarted',
      description: 'Your session has been completely reset. Please register again to start bidding.',
    });
  };

  // Create steps
  const steps = [
    { id: 'registration', title: 'Registration', description: 'Enter your details' },
    ...(collections || []).map(collection => ({
      id: collection.id,
      title: collection.name,
      description: `${items?.filter(item => item.collection_id === collection.id).length || 0} items`
    })),
    { id: 'review', title: 'Review & Submit', description: 'Review your bids' }
  ];

  const handleRegistration = (e: React.FormEvent) => {
    e.preventDefault();
    if (bidderName.trim() && bidderEmail.trim()) {
      registerBidderMutation.mutate();
    }
  };

  const handleBidUpdate = (itemId: string, bidData: BidData | null) => {
    setBids(prev => {
      const newBids = { ...prev };
      if (bidData && bidData.totalBid > 0) {
        newBids[itemId] = bidData;
      } else {
        delete newBids[itemId];
      }
      return newBids;
    });
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      submitAllBidsMutation.mutate();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleEditBid = (itemId: string) => {
    // Find which step contains this item
    const item = items?.find(i => i.id === itemId);
    if (item) {
      const collectionIndex = collections?.findIndex(c => c.id === item.collection_id);
      if (collectionIndex !== undefined && collectionIndex >= 0) {
        setCurrentStep(collectionIndex + 1); // +1 because registration is step 0
      }
    }
  };

  const handleRemoveBid = (itemId: string) => {
    handleBidUpdate(itemId, null);
  };

  const canGoPrevious = () => {
    if (currentStep === 0) return false;
    if (isBudgetExceeded) return false;
    if (hasValidationErrors) return false;
    return true;
  };

  const canGoNext = () => {
    if (currentStep === 0) return isRegistered;
    if (isBudgetExceeded) return false;
    if (hasValidationErrors) return false;
    return true;
  };

  // Thank you page
  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="text-center py-12">
            {auction.status === 'closed' ? (
              <div>
                <AlertCircle className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
                <h2 className="text-2xl font-semibold mb-2">Auction Closed</h2>
                <p className="text-gray-600 mb-6">
                  Sorry, this auction has already been closed. Your bids have not been submitted.
                </p>
                <Button
                  variant="outline"
                  onClick={() => window.location.href = '/'}
                  className="border-purple-200 hover:bg-purple-50 hover:border-purple-300"
                >
                  Return Home
                </Button>
              </div>
            ) : (
              <div>
                <div className="mb-6 celebration-bounce">
                  <div className="w-20 h-20 auction-gradient rounded-full flex items-center justify-center mx-auto shadow-lg">
                    <svg
                      className="w-10 h-10 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                </div>
                <h2 className="text-2xl font-semibold mb-2 auction-text-gradient">Bids Submitted!</h2>
                <div className="mb-6">
                  <Badge className="bg-green-100 text-green-800 text-sm">Complete</Badge>
                </div>
                <p className="text-gray-600 mb-2">
                  Your bids have been successfully submitted.
                </p>
                <p className="text-sm text-gray-500 mb-6">
                  We'll notify you about the auction results.
                </p>
                <Button
                  variant="outline"
                  onClick={() => window.location.reload()}
                  className="border-purple-200 hover:bg-purple-50 hover:border-purple-300"
                >
                  Submit Another Bid
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading state
  if (!auction || !collections || !items) {
    // Check if auction doesn't exist (404)
    if (!auctionLoading && !auction) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardContent className="text-center py-12">
              <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
              <h2 className="text-2xl font-semibold mb-2">
                Auction Not Found
              </h2>
              <p className="text-gray-600 mb-6">
                This auction link has expired or been replaced with a new one. Please contact the auction organizer for the updated link.
              </p>
              <Button
                variant="outline"
                onClick={() => window.location.href = '/'}
                className="border-purple-200 hover:bg-purple-50 hover:border-purple-300"
              >
                Return Home
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Show loading state
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12">
            <div className="space-y-4 animate-pulse">
              <div className="w-3/4 h-8 bg-gray-200 rounded-full mx-auto" />
              <div className="w-1/2 h-4 bg-gray-200 rounded-full mx-auto" />
              <div className="flex justify-center gap-4 mt-8">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="w-3 h-3 rounded-full bg-gray-200" />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show message if auction is not active
  if (auction.status !== 'active') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-12">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
            <h2 className="text-2xl font-semibold mb-2">
              {auction.status === 'paused' ? 'Auction Paused' : 'Auction Closed'}
            </h2>
            <p className="text-gray-600 mb-6">
              {auction.status === 'paused'
                ? "This auction has been temporarily paused. Please check back later."
                : "This auction has ended and is no longer accepting bids."}
            </p>
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="border-purple-200 hover:bg-purple-50 hover:border-purple-300"
            >
              Refresh Page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderStepContent = () => {
    // Registration Step
    if (currentStep === 0) {
      return (
        <Card className="w-full max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl auction-text-gradient">Welcome to {auction.name}</CardTitle>
            <CardDescription>Please register to start bidding</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleRegistration}>
              {registrationError && (
                <Alert variant="destructive">
                  <AlertDescription>{registrationError}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="name">Your Name</Label>
                <Input
                  id="name"
                  value={bidderName}
                  onChange={(e) => setBidderName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full"
                  disabled={isRegistered || registerBidderMutation.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={bidderEmail}
                  onChange={(e) => setBidderEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full"
                  disabled={isRegistered || registerBidderMutation.isPending}
                />
              </div>
              {!isRegistered && (
                <Button
                  type="submit"
                  className="w-full auction-gradient text-white"
                  disabled={!bidderName || !bidderEmail || registerBidderMutation.isPending}
                >
                  {registerBidderMutation.isPending ? 'Registering...' : 'Start Bidding'}
                </Button>
              )}
            </form>
          </CardContent>
        </Card>
      );
    }

    // Review Step
    if (currentStep === steps.length - 1) {
      return (
        <Card className="w-full max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl auction-text-gradient">Review Your Bids</CardTitle>
            <CardDescription>Please review your bids before final submission</CardDescription>
          </CardHeader>
          <CardContent>
            <ReviewStep
              bids={bids}
              items={items}
              collections={collections}
              maxBudget={auction.max_budget_per_bidder}
              onEditBid={handleEditBid}
              onRemoveBid={handleRemoveBid}
              isSubmitting={submitAllBidsMutation.isPending}
            />
          </CardContent>
        </Card>
      );
    }

    // Collection Step
    const collectionIndex = currentStep - 1;
    const collection = collections?.[collectionIndex];
    const collectionItems = items?.filter(item => item.collection_id === collection?.id) || [];

    if (!collection) return null;

    return (
      <CollectionStep
        collection={collection}
        items={collectionItems}
        maxBudget={auction.max_budget_per_bidder}
        currentBudgetUsed={currentBudgetUsed}
        bids={bids}
        onBidUpdate={handleBidUpdate}
        onValidationChange={setHasValidationErrors}
      />
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Budget Summary */}
        {isRegistered && (
          <Card className="gradient-border">
            <div className="gradient-border-content p-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <User className="w-5 h-5 text-purple-600" />
                    <span className="font-medium">{bidderName}</span>
                  </div>
                  <Separator orientation="vertical" className="h-6" />
                  <div className="flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-blue-600" />
                    <span>Budget: ₹{auction.max_budget_per_bidder.toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex-1 md:max-w-[200px]">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Used: ₹{currentBudgetUsed.toLocaleString()}</span>
                    <span className={isBudgetExceeded ? 'text-red-600' : 'text-green-600'}>
                      {((currentBudgetUsed / auction.max_budget_per_bidder) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <Progress
                    value={(currentBudgetUsed / auction.max_budget_per_bidder) * 100}
                    className={cn(
                      "h-2 transition-all",
                      isBudgetExceeded ? "bg-red-100 [&>div]:bg-red-500" : "bg-blue-100 [&>div]:bg-blue-500"
                    )}
                  />
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Main Content */}
        <div className="space-y-6">
          {/* Stepper */}
          <div className="flex justify-center">
            <nav className="flex space-x-2">
              {steps.map((step, index) => (
                <div
                  key={`step-${index}`}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                    currentStep === index
                      ? "auction-gradient text-white shadow-lg scale-110"
                      : index < currentStep
                      ? "bg-purple-100 text-purple-700"
                      : "bg-gray-100 text-gray-400"
                  )}
                >
                  {index + 1}
                </div>
              ))}
            </nav>
          </div>

          {/* Step Content */}
          {renderStepContent()}

          {/* Navigation */}
          {isRegistered && (
            <div className="flex justify-between pt-6">
              <Button
                onClick={handlePrevious}
                disabled={!canGoPrevious() || hasValidationErrors}
                variant="outline"
                className="border-purple-200 hover:bg-purple-50 hover:border-purple-300"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>
              {currentStep < steps.length - 1 ? (
                <Button
                  onClick={handleNext}
                  disabled={!canGoNext() || hasValidationErrors}
                  className="auction-gradient text-white shadow-md hover:shadow-lg"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  onClick={() => submitAllBidsMutation.mutate()}
                  disabled={hasValidationErrors || isBudgetExceeded || submitAllBidsMutation.isPending}
                  className="auction-gradient text-white shadow-md hover:shadow-lg"
                >
                  {submitAllBidsMutation.isPending ? (
                    <span className="animate-pulse">Submitting...</span>
                  ) : (
                    <>
                      Submit Bids
                      <Send className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
