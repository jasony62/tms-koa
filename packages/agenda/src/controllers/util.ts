import querystring from 'querystring'

// http://example.com/foo
// =>
// http://example.com/foo?query1=value1&query2=value2
export const buildUrlWithQuery = ({ url, query }) => {
  if (query) {
    query = querystring.stringify(query)
    if (query !== '') {
      url += `?${query}`
    }
  }

  return url
}
