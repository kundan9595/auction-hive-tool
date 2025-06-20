
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/Layout';
import { Link } from 'react-router-dom';
import { Plus, Eye, Settings, BarChart3 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface Auction {
  id: string;
  name: string;
  description: string | null;
  status: string;
  max_budget_per_bidder: number;
  slug: string;
  created_at: string;
}

function AuctionCard({ auction }: { auction: Auction }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'active': return 'bg-green-100 text-green-800';
      case 'closed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{auction.name}</CardTitle>
            <CardDescription className="mt-1">
              {auction.description || 'No description provided'}
            </CardDescription>
          </div>
          <Badge className={getStatusColor(auction.status)}>
            {auction.status.charAt(0).toUpperCase() + auction.status.slice(1)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="text-sm text-gray-600">
            Max Budget per Bidder: <span className="font-medium">₹{auction.max_budget_per_bidder}</span>
          </div>
          <div className="text-sm text-gray-600">
            Created: {new Date(auction.created_at).toLocaleDateString()}
          </div>
          
          <div className="flex space-x-2 pt-2">
            <Link to={`/auction/${auction.slug}/manage`}>
              <Button size="sm" variant="outline">
                <Settings className="w-4 h-4 mr-1" />
                Manage
              </Button>
            </Link>
            {auction.status === 'active' && (
              <>
                <Link to={`/auction/${auction.slug}/monitor`}>
                  <Button size="sm" variant="outline">
                    <BarChart3 className="w-4 h-4 mr-1" />
                    Monitor
                  </Button>
                </Link>
                <Link to={`/auction/${auction.slug}/bid`}>
                  <Button size="sm" variant="outline">
                    <Eye className="w-4 h-4 mr-1" />
                    View
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function Dashboard() {
  const { user } = useAuth();

  const { data: auctions, isLoading } = useQuery({
    queryKey: ['auctions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auctions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Auction[];
    },
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600">Manage your auctions and view performance</p>
          </div>
          <Link to="/create-auction">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Auction
            </Button>
          </Link>
        </div>

        {auctions && auctions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {auctions.map((auction) => (
              <AuctionCard key={auction.id} auction={auction} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <div className="max-w-sm mx-auto">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Plus className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No auctions yet</h3>
                <p className="text-gray-600 mb-4">
                  Get started by creating your first auction.
                </p>
                <Link to="/create-auction">
                  <Button>Create Your First Auction</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
