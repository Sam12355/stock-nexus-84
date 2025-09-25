import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp } from "lucide-react";

interface ItemStockUsageChartProps {
  branchId?: string;
}

interface ItemOption {
  id: string;
  name: string;
}

interface UsageData {
  period: string;
  usage: number;
}

export const ItemStockUsageChart = ({ branchId }: ItemStockUsageChartProps) => {
  const [items, setItems] = useState<ItemOption[]>([]);
  const [selectedItem, setSelectedItem] = useState<string>("");
  const [timePeriod, setTimePeriod] = useState("daily");
  const [usageData, setUsageData] = useState<UsageData[]>([]);
  const [loading, setLoading] = useState(false);
  const [itemsLoaded, setItemsLoaded] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!branchId || itemsLoaded) return;
    
    try {
      const { data, error } = await supabase
        .from('items')
        .select('id, name')
        .eq('branch_id', branchId)
        .order('name');
      
      if (error) throw error;
      setItems(data || []);
      setItemsLoaded(true);
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  }, [branchId, itemsLoaded]);

  const generateChart = useCallback(async () => {
    if (!selectedItem || !branchId) return;
    
    setLoading(true);
    try {
      let periods: string[] = [];
      const now = new Date();
      
      if (timePeriod === 'daily') {
        // Last 7 days
        for (let i = 6; i >= 0; i--) {
          const date = new Date(now);
          date.setDate(date.getDate() - i);
          periods.push(date.toISOString().split('T')[0]);
        }
      } else if (timePeriod === 'monthly') {
        // Last 6 months
        for (let i = 5; i >= 0; i--) {
          const date = new Date(now);
          date.setMonth(date.getMonth() - i);
          periods.push(date.toISOString().slice(0, 7));
        }
      } else if (timePeriod === 'yearly') {
        // Last 3 years
        for (let i = 2; i >= 0; i--) {
          const date = new Date(now);
          date.setFullYear(date.getFullYear() - i);
          periods.push(date.getFullYear().toString());
        }
      }

      const startDate = timePeriod === 'yearly' 
        ? `${periods[0]}-01-01` 
        : timePeriod === 'monthly' 
          ? `${periods[0]}-01` 
          : periods[0];
      
      const { data: movementsData, error } = await supabase
        .from('stock_movements')
        .select('movement_type, quantity, created_at')
        .eq('item_id', selectedItem)
        .gte('created_at', startDate)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group by period
      const usageByPeriod: { [key: string]: number } = {};
      (movementsData || []).forEach(movement => {
        const date = new Date(movement.created_at);
        let periodKey = '';
        
        if (timePeriod === 'daily') {
          periodKey = date.toISOString().split('T')[0];
        } else if (timePeriod === 'monthly') {
          periodKey = date.toISOString().slice(0, 7);
        } else if (timePeriod === 'yearly') {
          periodKey = date.getFullYear().toString();
        }
        
        usageByPeriod[periodKey] = (usageByPeriod[periodKey] || 0) + movement.quantity;
      });

      const chartData = periods.map(period => ({
        period,
        usage: usageByPeriod[period] || 0
      }));

      setUsageData(chartData);
    } catch (error) {
      console.error('Error fetching usage data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedItem, branchId, timePeriod]);

  // Load items when component mounts
  useState(() => {
    fetchItems();
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <label className="text-sm font-medium mb-2 block">Select Item</label>
          <Select value={selectedItem} onValueChange={setSelectedItem} onOpenChange={() => fetchItems()}>
            <SelectTrigger>
              <SelectValue placeholder="Choose an item..." />
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <label className="text-sm font-medium mb-2 block">Time Period</label>
          <Select value={timePeriod} onValueChange={setTimePeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <Button 
          onClick={generateChart} 
          disabled={!selectedItem || loading}
          className="mb-0"
        >
          {loading ? "Generating..." : "Generate Chart"}
        </Button>
      </div>

      {usageData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              {items.find(item => item.id === selectedItem)?.name} - Stock Usage ({timePeriod.charAt(0).toUpperCase() + timePeriod.slice(1)})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {loading ? (
                <div className="space-y-2 p-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart data={usageData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="period" 
                      tick={{ fontSize: 12 }}
                      interval={0}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => `Period: ${value}`}
                      formatter={(value) => [`${value}`, 'Usage']}
                    />
                    <Bar 
                      dataKey="usage" 
                      fill="hsl(var(--primary))" 
                      name="Stock Usage"
                      radius={[4, 4, 0, 0]}
                    />
                  </RechartsBarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};