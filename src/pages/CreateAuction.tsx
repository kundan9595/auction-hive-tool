
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

export function CreateAuction() {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const maxBudget = parseFloat(formData.get('maxBudget') as string);

    try {
      // Generate slug
      const { data: slugData, error: slugError } = await supabase
        .rpc('generate_auction_slug', { auction_name: name });

      if (slugError) throw slugError;

      // Create auction
      const { data, error } = await supabase
        .from('auctions')
        .insert({
          name,
          description: description || null,
          max_budget_per_bidder: maxBudget,
          slug: slugData,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Auction Created!',
        description: 'Your auction has been created successfully.',
      });

      navigate(`/auction/${data.slug}/manage`);
    } catch (error) {
      console.error('Error creating auction:', error);
      toast({
        title: 'Error',
        description: 'Failed to create auction. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Create New Auction</CardTitle>
            <CardDescription>
              Set up your auction details. You can add collections and items after creation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Auction Name *</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="e.g., Summer 2024 Art Auction"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Brief description of your auction..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxBudget">Max Budget per Bidder (₹) *</Label>
                <Input
                  id="maxBudget"
                  name="maxBudget"
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="300"
                  required
                />
                <p className="text-sm text-gray-600">
                  This is the maximum amount each bidder can spend across all items.
                </p>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Auction Type</h4>
                <p className="text-sm text-blue-700">
                  This auction will be a <strong>Closed Auction</strong> where all bids remain hidden until the auction closes.
                </p>
              </div>

              <div className="flex space-x-4">
                <Button type="submit" disabled={isLoading} className="flex-1">
                  {isLoading ? 'Creating...' : 'Create Auction'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/dashboard')}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
