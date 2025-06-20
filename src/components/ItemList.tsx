
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Item {
  id: string;
  collection_id: string;
  name: string;
  description: string | null;
  starting_bid: number;
  inventory: number;
  sort_order: number;
}

interface ItemListProps {
  items: Item[];
  auctionStatus: 'draft' | 'active' | 'closed';
}

export function ItemList({ items, auctionStatus }: ItemListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Items in Collection</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-gray-500 text-center py-4">
            No items in this collection yet. Add some items to get started.
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="p-3 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h5 className="font-medium">{item.name}</h5>
                    {item.description && (
                      <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                    )}
                    <div className="flex space-x-4 text-xs text-gray-500 mt-2">
                      <span>Starting Bid: ₹{item.starting_bid}</span>
                      <span>Quantity: {item.inventory}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
