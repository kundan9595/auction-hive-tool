
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { User, Wallet } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Stepper } from '@/components/Stepper';
import { CollectionStep } from '@/components/CollectionStep';
import { ReviewStep } from '@/components/ReviewStep';

interface Auction {
  id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'active' | 'closed';
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
  
  // Stepper state
  const [currentStep, setCurrentStep] = useState(0);
  const [bids, setBids] = useState<Record<string, BidData>>({});

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

      if (error) throw error;
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

  // Submit all bids mutation
  const submitAllBidsMutation = useMutation({
    mutationFn: async () => {
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

      console.log('Bids submitted successfully');
    },
    onSuccess: () => {
      // Clear saved data
      if (slug) {
        localStorage.removeItem(`auction-${slug}-bidder-data`);
      }
      toast({
        title: 'Bids Submitted Successfully!',
        description: `${Object.values(bids).filter(b => b.totalBid > 0).length} bids have been submitted.`,
      });
      // Reset form
      setBids({});
      setCurrentStep(0);
    },
    onError: (error) => {
      console.error('Error submitting bids:', error);
      toast({
        title: 'Error',
        description: `Failed to submit bids: ${error.message}. Please try again.`,
        variant: 'destructive',
      });
    },
  });

  // Calculate budget usage
  const currentBudgetUsed = Object.values(bids).reduce((sum, bid) => sum + bid.totalBid, 0);

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
      setIsRegistered(true);
      setCurrentStep(1);
      toast({
        title: 'Registration Successful',
        description: 'You can now proceed to place bids.',
      });
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

  const canGoNext = () => {
    if (currentStep === 0) return isRegistered;
    return true; // Allow navigation between collection steps even without bids
  };

  if (auctionLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading auction...</p>
        </div>
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="text-center py-12">
            <h2 className="text-xl font-semibold mb-2">Auction Not Found</h2>
            <p className="text-gray-600">The auction you're looking for doesn't exist.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (auction.status !== 'active') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="text-center py-12">
            <h2 className="text-xl font-semibold mb-2">Auction Not Active</h2>
            <p className="text-gray-600">
              This auction is currently {auction.status}. Bidding is only available when the auction is active.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderStepContent = () => {
    if (currentStep === 0) {
      // Registration Step
      return (
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Register to Bid
            </CardTitle>
            <CardDescription>
              Enter your details to participate in the auction
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegistration} className="space-y-4">
              <div>
                <Label htmlFor="bidder-name">Full Name</Label>
                <Input
                  id="bidder-name"
                  value={bidderName}
                  onChange={(e) => setBidderName(e.target.value)}
                  required
                  placeholder="Enter your full name"
                />
              </div>
              <div>
                <Label htmlFor="bidder-email">Email Address</Label>
                <Input
                  id="bidder-email"
                  type="email"
                  value={bidderEmail}
                  onChange={(e) => setBidderEmail(e.target.value)}
                  required
                  placeholder="Enter your email"
                />
              </div>
              <Button type="submit" className="w-full">
                Continue to Bidding
              </Button>
            </form>
          </CardContent>
        </Card>
      );
    }

    if (currentStep === steps.length - 1) {
      // Review Step
      return (
        <ReviewStep
          bids={bids}
          items={items || []}
          collections={collections || []}
          maxBudget={auction.max_budget_per_bidder}
          onEditBid={handleEditBid}
          onRemoveBid={handleRemoveBid}
          onSubmitAllBids={() => submitAllBidsMutation.mutate()}
          isSubmitting={submitAllBidsMutation.isPending}
        />
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
      />
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Auction Header */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl">{auction.name}</CardTitle>
            <CardDescription>
              {auction.description || 'Welcome to this auction'}
            </CardDescription>
            <div className="flex gap-2">
              <Badge className="bg-green-100 text-green-800">Active</Badge>
              <Badge variant="outline">Max Budget: ₹{auction.max_budget_per_bidder}</Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Budget Summary (when registered) */}
        {isRegistered && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                Budget Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Bidder</p>
                  <p className="font-medium">{bidderName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Budget</p>
                  <p className="font-medium">₹{auction.max_budget_per_bidder}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Budget Used</p>
                  <p className="font-medium text-blue-600">₹{currentBudgetUsed}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Remaining Budget</p>
                  <p className="font-medium text-green-600">
                    ₹{auction.max_budget_per_bidder - currentBudgetUsed}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stepper */}
        <Stepper
          steps={steps}
          currentStep={currentStep}
          onStepChange={setCurrentStep}
          canGoNext={canGoNext()}
          canGoPrevious={currentStep > 0}
          onNext={handleNext}
          onPrevious={handlePrevious}
          showNavigation={isRegistered}
        />

        {/* Step Content */}
        <div className="mt-8">
          {renderStepContent()}
        </div>
      </div>
    </div>
  );
}
