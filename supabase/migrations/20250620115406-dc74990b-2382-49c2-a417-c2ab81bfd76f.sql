
-- Drop the existing policy that's causing issues
DROP POLICY IF EXISTS "Allow bidding in active auctions" ON public.bids;

-- Create a more permissive policy for anonymous bidding
CREATE POLICY "Allow anonymous bidding in active auctions" ON public.bids
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.auctions 
      WHERE auctions.id = bids.auction_id 
      AND auctions.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.auctions 
      WHERE auctions.id = bids.auction_id 
      AND auctions.status = 'active'
    )
  );

-- Ensure the bids table allows anonymous access
ALTER TABLE public.bids FORCE ROW LEVEL SECURITY;
