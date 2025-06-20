
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/Layout';
import { Link } from 'react-router-dom';
import { Plus, Eye, Settings, BarChart3, Trophy, Rocket } from 'lucide-react';
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
      case 'draft': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'active': return 'bg-green-100 text-green-800 border-green-300';
      case 'closed': return 'bg-purple-100 text-purple-800 border-purple-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return '🟢';
      case 'closed': return '🏁';
      default: return '📝';
    }
  };

  return (
    <div className="gradient-border card-hover">
      <div className="gradient-border-content p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-lg">{getStatusIcon(auction.status)}</span>
              <h3 className="text-lg font-bold text-gray-900">{auction.name}</h3>
            </div>
            <p className="text-gray-600 text-sm">
              {auction.description || 'No description provided'}
            </p>
          </div>
          <Badge className={`${getStatusColor(auction.status)} border font-medium`}>
            {auction.status.charAt(0).toUpperCase() + auction.status.slice(1)}
          </Badge>
        </div>

        <div className="space-y-3">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-3 rounded-lg">
            <div className="text-sm text-gray-700">
              💰 Max Budget per Bidder: <span className="font-bold text-purple-700">₹{auction.max_budget_per_bidder}</span>
            </div>
          </div>
          
          <div className="text-xs text-gray-500">
            📅 Created: {new Date(auction.created_at).toLocaleDateString()}
          </div>
          
          <div className="flex flex-wrap gap-2 pt-2">
            <Link to={`/auction/${auction.slug}/manage`}>
              <Button size="sm" variant="outline" className="border-purple-200 hover:bg-purple-50 hover:border-purple-300">
                <Settings className="w-4 h-4 mr-1" />
                Manage
              </Button>
            </Link>
            {auction.status === 'active' && (
              <Link to={`/auction/${auction.slug}/bid`}>
                <Button size="sm" className="auction-gradient text-white shadow-md hover:shadow-lg">
                  <Eye className="w-4 h-4 mr-1" />
                  View & Bid
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
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
          <div className="auction-gradient h-32 rounded-2xl mb-8 flex items-center justify-center">
            <div className="text-white text-lg font-medium">Loading your auctions...</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        {/* Hero Header */}
        <div className="auction-gradient rounded-2xl p-8 text-white text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-white/10 backdrop-blur-sm"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <Trophy className="w-8 h-8" />
              <h1 className="text-3xl font-bold">Auction Dashboard</h1>
              <Trophy className="w-8 h-8" />
            </div>
            <p className="text-white/90 text-lg mb-6">
              Manage your auctions and track performance in real-time
            </p>
            <Link to="/create-auction">
              <Button size="lg" className="bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm">
                <Plus className="w-5 h-5 mr-2" />
                Create New Auction
              </Button>
            </Link>
          </div>
        </div>

        {auctions && auctions.length > 0 ? (
          <div>
            <div className="flex items-center space-x-2 mb-6">
              <Rocket className="w-6 h-6 text-purple-600" />
              <h2 className="text-2xl font-bold text-gray-900">Your Auctions</h2>
              <Badge className="bg-purple-100 text-purple-800 border-purple-300">
                {auctions.length} total
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {auctions.map((auction) => (
                <AuctionCard key={auction.id} auction={auction} />
              ))}
            </div>
          </div>
        ) : (
          <Card className="border-2 border-dashed border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50">
            <CardContent className="text-center py-16">
              <div className="max-w-sm mx-auto">
                <div className="w-20 h-20 auction-gradient rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <Plus className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Ready to Start Your First Auction? 🎯</h3>
                <p className="text-gray-600 mb-6">
                  Create engaging auctions and watch the bidding excitement unfold!
                </p>
                <Link to="/create-auction">
                  <Button size="lg" className="auction-gradient text-white shadow-lg hover:shadow-xl">
                    <Rocket className="w-5 h-5 mr-2" />
                    Create Your First Auction
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
