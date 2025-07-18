import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ConversationList } from "./ConversationList";

export default async function Threads() {
  return (
    <div className="pt-12">
      <Tabs defaultValue="all" className="p-4">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>
        <TabsContent value="all">
          <ConversationList threadStatus="active" />
        </TabsContent>
        <TabsContent value="archived">
          <ConversationList threadStatus="archived" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
