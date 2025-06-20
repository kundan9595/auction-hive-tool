
-- Drop all existing policies on bids table
DROP POLICY IF EXISTS "Anyone can insert bids in active auctions" ON public.bids;
DROP POLICY IF EXISTS "Allow anonymous bids in active auctions" ON public.bids;
DROP POLICY IF EXISTS "Admins can view bids in their auctions" ON public.bids;
DROP POLICY IF EXISTS "Public can view bids in active auctions" ON public.bids;

-- Create a comprehensive policy that allows anonymous bidding
CREATE POLICY "Allow bidding in active auctions" ON public.bids
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

-- Allow admins to view bids in their auctions (authenticated users only)
CREATE POLICY "Admins can view bids in their auctions" ON public.bids
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.auctions 
      WHERE auctions.id = bids.auction_id 
      AND auctions.admin_id = auth.uid()
    )
  );
