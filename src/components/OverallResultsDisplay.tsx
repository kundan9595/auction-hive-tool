
import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, Users, Package, TrendingUp, AlertCircle } from 'lucide-react';

interface OverallResultsDisplayProps {
  auctionId: string;
}

interface OverallResult {
  id: string;
  item_id: string;
  winner_name: string;
  winning_amount: number;
  quantity_won: number;
  price_per_unit_paid: number;
  original_bid_per_unit: number;
  refund_amount: number;
  item: {
    name: string;
    starting_bid: number;
    inventory: number;
    collection: {
      name: string;
    };
  };
}

interface AuctionStats {
  totalRevenue: number;
  totalRefunds: number;
  totalItemsSold: number;
  uniqueWinners: number;
  averageDiscount: number;
}

export function OverallResultsDisplay({ auctionId }: OverallResultsDisplayProps) {
  const queryClient = useQueryClient();

  // Fetch all auction results
  const { data: allResults, isLoading } = useQuery({
    queryKey: ['overall-results', auctionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auction_results')
        .select(`
          *,
          item:items!inner(
            name,
            starting_bid,
            inventory,
            collection:collections!inner(name)
          )
        `)
        .eq('auction_id', auctionId)
        .order('winning_amount', { ascending: false });

      if (error) throw error;
      return data as OverallResult[];
    },
  });

  // Real-time subscription for overall auction results
  useEffect(() => {
    const channel = supabase
      .channel(`overall-results-${auctionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'auction_results',
          filter: `auction_id=eq.${auctionId}`,
        },
        (payload) => {
          console.log('Overall results updated:', payload);
          // Invalidate queries to trigger refetch
          queryClient.invalidateQueries({ queryKey: ['overall-results', auctionId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [auctionId, queryClient]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-gray-200 rounded" />
          <div className="h-48 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (!allResults || allResults.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No auction results available yet. Results will appear here once the auction is closed and processed.
        </AlertDescription>
      </Alert>
    );
  }

  // Calculate overall statistics
  const stats: AuctionStats = {
    totalRevenue: allResults.reduce((sum, result) => sum + result.winning_amount, 0),
    totalRefunds: allResults.reduce((sum, result) => sum + result.refund_amount, 0),
    totalItemsSold: allResults.reduce((sum, result) => sum + result.quantity_won, 0),
    uniqueWinners: new Set(allResults.map(result => result.winner_name)).size,
    averageDiscount: allResults.length > 0 
      ? allResults.reduce((sum, result) => sum + ((result.original_bid_per_unit - result.price_per_unit_paid) / result.original_bid_per_unit * 100), 0) / allResults.length
      : 0
  };

  // Group results by collection
  const resultsByCollection = allResults.reduce((acc, result) => {
    const collectionName = result.item.collection.name;
    if (!acc[collectionName]) {
      acc[collectionName] = [];
    }
    acc[collectionName].push(result);
    return acc;
  }, {} as Record<string, OverallResult[]>);

  // Top winners by spending
  const winnerSpending = allResults.reduce((acc, result) => {
    const winnerName = result.winner_name;
    if (!acc[winnerName]) {
      acc[winnerName] = { total: 0, items: 0, refund: 0 };
    }
    acc[winnerName].total += result.winning_amount;
    acc[winnerName].items += result.quantity_won;
    acc[winnerName].refund += result.refund_amount;
    return acc;
  }, {} as Record<string, { total: number; items: number; refund: number }>);

  const topWinners = Object.entries(winnerSpending)
    .sort(([,a], [,b]) => b.total - a.total)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Overall Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-lg font-semibold">₹{stats.totalRevenue.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Items Sold</p>
                <p className="text-lg font-semibold">{stats.totalItemsSold.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">Unique Winners</p>
                <p className="text-lg font-semibold">{stats.uniqueWinners}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-orange-600" />
              <div>
                <p className="text-sm text-gray-600">Avg. Discount</p>
                <p className="text-lg font-semibold">{stats.averageDiscount.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Winners */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Top Winners by Spending
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>Winner</TableHead>
                <TableHead>Total Spent</TableHead>
                <TableHead>Items Won</TableHead>
                <TableHead>Total Refund</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topWinners.map(([name, stats], index) => (
                <TableRow key={name}>
                  <TableCell>
                    <Badge variant={index < 3 ? "default" : "secondary"}>
                      #{index + 1}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{name}</TableCell>
                  <TableCell>₹{stats.total.toLocaleString()}</TableCell>
                  <TableCell>{stats.items}</TableCell>
                  <TableCell className="text-green-600">₹{stats.refund.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Results by Collection */}
      {Object.entries(resultsByCollection).map(([collectionName, results]) => (
        <Card key={collectionName}>
          <CardHeader>
            <CardTitle>{collectionName} Results</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Winner</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Final Price</TableHead>
                  <TableHead>Original Bid</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result) => (
                  <TableRow key={result.id}>
                    <TableCell className="font-medium">{result.item.name}</TableCell>
                    <TableCell>{result.winner_name}</TableCell>
                    <TableCell>{result.quantity_won}</TableCell>
                    <TableCell>₹{result.price_per_unit_paid.toLocaleString()}</TableCell>
                    <TableCell>₹{result.original_bid_per_unit.toLocaleString()}</TableCell>
                    <TableCell className="font-semibold">₹{result.winning_amount.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
