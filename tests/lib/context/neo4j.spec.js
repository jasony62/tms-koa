describe('#context.neo4j', () => {
  const { Context } = require('@/lib/context/neo4j')
  let neo4jDriver
  describe('#context.neo4j.js', () => {
    it('获得neo4j连接实例', async () => {
      let instances = await Context.init({ host: 'localhost', port: 7687 })
      expect(instances).toHaveLength(1)
      neo4jDriver = instances[0]
    })
    it('执行1次操作', async () => {
      const session = await neo4jDriver.session()
      const personName = 'Alice'
      const result = await session.run(
        'CREATE (a:Person {name: $name}) RETURN a',
        { name: personName }
      )

      const singleRecord = result.records[0]
      const node = singleRecord.get(0)

      expect(node.properties.name).toBe(personName)
    })
    // 必须执行关闭操作
    afterAll(async () => await Context.close())
  })
})
